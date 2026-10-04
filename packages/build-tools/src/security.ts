import ts from 'typescript';
import postcss from 'postcss';
import type { ComponentManifest, Diagnostic } from '@osai/contract-schemas';

/** Static guards catch known sinks; behavior and restrictive-CSP tests remain required. */
export function scanJavaScript(
  source: string,
  manifest: ComponentManifest,
  namespace = 'OSAI.Components.v1',
): Diagnostic[] {
  const findings: Diagnostic[] = [];
  const file = ts.createSourceFile(
    'artifact.js',
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  );
  const aliases = new Map<string, ts.Expression>();
  const declared = new Set<string>();
  const nodes = new Map<string, string>();
  const globals = new Set(['window', 'globalThis', 'self']);
  const namespaceParts = namespace.split('.');
  const report = (code: string, node: ts.Node, message: string): void => {
    const position = file.getLineAndCharacterOfPosition(node.getStart(file));
    const path = `/script/${position.line + 1}/${position.character + 1}`;
    if (!findings.some((item) => item.code === code && item.path === path))
      findings.push({ code, path, message });
  };
  const unwrap = (expression: ts.Expression): ts.Expression => {
    if (ts.isParenthesizedExpression(expression)) return unwrap(expression.expression);
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.CommaToken
    )
      return unwrap(expression.right);
    return expression;
  };
  const staticText = (
    expression: ts.Expression | undefined,
    seen = new Set<string>(),
  ): string | undefined => {
    if (!expression) return undefined;
    const node = unwrap(expression);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = staticText(node.left, new Set(seen));
      const right = staticText(node.right, new Set(seen));
      return left !== undefined && right !== undefined ? left + right : undefined;
    }
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      seen.add(node.text);
      return staticText(aliases.get(node.text), seen);
    }
    return undefined;
  };
  const pathOf = (expression: ts.Expression, seen = new Set<string>()): string[] | undefined => {
    const node = unwrap(expression);
    if (ts.isIdentifier(node)) {
      if (globals.has(node.text) || !aliases.has(node.text) || seen.has(node.text))
        return [node.text];
      seen.add(node.text);
      return pathOf(aliases.get(node.text)!, seen) ?? [node.text];
    }
    if (ts.isPropertyAccessExpression(node)) {
      const parent = pathOf(node.expression, seen);
      return parent ? [...parent, node.name.text] : undefined;
    }
    if (ts.isElementAccessExpression(node)) {
      const parent = pathOf(node.expression, seen);
      const key = staticText(node.argumentExpression);
      return parent ? [...parent, key ?? '*'] : undefined;
    }
    if (ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node)) return ['<value>'];
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return ['<function>'];
    return undefined;
  };
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      declared.add(node.name.text);
      if (node.initializer) aliases.set(node.name.text, node.initializer);
    }
    if ((ts.isParameter(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name))
      declared.add(node.name.text);
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
      declared.add(node.name.text);
    ts.forEachChild(node, collect);
  };
  collect(file);
  for (const [name, expression] of aliases) {
    if (
      ts.isCallExpression(expression) &&
      pathOf(expression.expression)?.slice(-1)[0] === 'createElement'
    ) {
      const tag = staticText(expression.arguments[0]);
      if (tag) nodes.set(name, tag.toLowerCase());
    }
    if (
      ts.isNewExpression(expression) &&
      pathOf(expression.expression)?.slice(-1)[0] === 'XMLHttpRequest'
    )
      nodes.set(name, 'xhr');
  }
  const approvedGlobal = (path: string[]): boolean => {
    if (!globals.has(path[0] ?? '')) return true;
    const member = path.slice(1);
    return (
      member.length > 0 &&
      member.every(
        (part, index) => index >= namespaceParts.length || part === namespaceParts[index],
      )
    );
  };
  const inspectResource = (
    expression: ts.Expression | undefined,
    node: ts.Node,
    kind: 'network' | 'asset' | 'worker' = 'network',
  ): void => {
    if (
      expression &&
      ts.isCallExpression(expression) &&
      pathOf(expression.expression)?.at(-1) === 'resolveAsset'
    ) {
      const id = staticText(expression.arguments[0]);
      const asset = manifest.assets.find((item) => item.path === id);
      if (
        !asset ||
        (kind === 'worker' &&
          (asset.type !== 'worker' || !manifest.capabilities.workers.includes(id!)))
      )
        report('undeclared-asset', node, 'Logical resource is not declared for this usage.');
      return;
    }
    let url = staticText(expression);
    if (
      expression &&
      ts.isNewExpression(expression) &&
      pathOf(expression.expression)?.slice(-1)[0] === 'URL'
    )
      url = staticText(expression.arguments?.[0]);
    if (url === undefined) {
      report(
        'unverifiable-resource',
        node,
        'Resource URLs must resolve to declared literals or an audited adapter.',
      );
      return;
    }
    if (/^(?:javascript|data|blob):/i.test(url)) {
      report(
        'undeclared-inline-asset',
        node,
        'Executable, inline, and object URLs require a separately reviewed capability.',
      );
      return;
    }
    const asset = manifest.assets.find(
      (item) =>
        item.path === url ||
        (item.origin && `${item.origin}/${item.path.replace(/^\//, '')}` === url),
    );
    let absolute: URL | undefined;
    try {
      absolute = new URL(url);
    } catch {
      /* Local assets use their declared path. */
    }
    if (absolute && !manifest.capabilities.networkOrigins.includes(absolute.origin))
      report('undeclared-origin', node, 'Runtime resource origin is not declared.');
    if ((!absolute && !asset) || (kind !== 'network' && !asset))
      report('undeclared-asset', node, 'Runtime asset is not declared by exact path.');
    if (kind === 'worker' && !manifest.capabilities.workers.includes(url))
      report('undeclared-worker', node, 'Worker entry must be declared as a capability.');
  };
  const inspectWrite = (
    left: ts.Expression,
    right: ts.Expression | undefined,
    node: ts.Node,
  ): void => {
    const path = pathOf(left);
    if (path && globals.has(path[0] ?? '') && !approvedGlobal(path))
      report(
        'undeclared-global',
        node,
        'Global writes must belong to the approved bridge namespace.',
      );
    if (ts.isIdentifier(left) && !declared.has(left.text))
      report('undeclared-global', node, 'Assignment to an undeclared global is prohibited.');
    const member = path?.slice(-1)[0];
    if (
      member &&
      /^on[a-z]+$/i.test(member) &&
      right &&
      (staticText(right) !== undefined || ts.isTemplateExpression(right))
    )
      report('inline-handler', node, 'String event handlers are prohibited.');
    if (['innerHTML', 'outerHTML', 'srcdoc'].includes(member ?? ''))
      report('html-execution-sink', node, 'Raw HTML sinks require an explicitly audited renderer.');
    if (['src', 'href', 'poster', 'data'].includes(member ?? ''))
      inspectResource(right, node, 'asset');
    if (
      ['text', 'textContent'].includes(member ?? '') &&
      path?.[0] &&
      nodes.get(path[0]) === 'script'
    )
      report('inline-execution', node, 'Inline script contents are prohibited.');
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const path = pathOf(node.expression) ?? [];
      const member = path.at(-1);
      if (
        path.includes('eval') ||
        path.includes('Function') ||
        path.slice(-2).join('.') === 'constructor.constructor' ||
        (path[0] === '<function>' && member === 'constructor')
      )
        report('dynamic-evaluation', node, 'Dynamic code evaluation is prohibited.');
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || member === 'require')
        report('unresolved-module', node, 'Production assets must not import runtime modules.');
      if (
        ['setTimeout', 'setInterval'].includes(member ?? '') &&
        node.arguments?.[0] &&
        (staticText(node.arguments[0]) !== undefined || ts.isTemplateExpression(node.arguments[0]))
      )
        report('inline-execution', node, 'Timer source strings are prohibited.');
      if (['fetch', 'WebSocket', 'EventSource', 'sendBeacon'].includes(member ?? ''))
        inspectResource(node.arguments?.[0], node);
      if (['Worker', 'SharedWorker', 'importScripts'].includes(member ?? ''))
        inspectResource(node.arguments?.[0], node, 'worker');
      if (
        member === 'open' &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        nodes.get(node.expression.expression.text) === 'xhr'
      )
        inspectResource(node.arguments?.[1], node);
      if (
        ['write', 'writeln', 'insertAdjacentHTML'].includes(member ?? '') &&
        (member === 'insertAdjacentHTML' || path.includes('document'))
      )
        report(
          'html-execution-sink',
          node,
          'Raw HTML sinks require an explicitly audited renderer.',
        );
      if (member === 'setAttribute') {
        const attribute = staticText(node.arguments?.[0]);
        if (attribute && /^on[a-z]+$/i.test(attribute))
          report('inline-handler', node, 'HTML event attributes are prohibited.');
        if (['src', 'href', 'poster', 'data'].includes(attribute ?? ''))
          inspectResource(node.arguments?.[1], node, 'asset');
        if (attribute === 'srcdoc')
          report('html-execution-sink', node, 'Inline frame contents are prohibited.');
      }
      if (path.join('.') === 'Object.defineProperty' || path.join('.') === 'Reflect.set') {
        const target = node.arguments?.[0] && pathOf(node.arguments[0]);
        if (target && globals.has(target[0] ?? '')) {
          const name = staticText(node.arguments?.[1]);
          if (!name || !approvedGlobal([...target, name]))
            report(
              'undeclared-global',
              node,
              'Computed global writes must resolve inside the approved namespace.',
            );
        }
      }
      if (path.join('.') === 'Object.assign') {
        const target = node.arguments?.[0] && pathOf(node.arguments[0]);
        if (target && globals.has(target[0] ?? ''))
          for (const argument of node.arguments?.slice(1) ?? []) {
            if (!ts.isObjectLiteralExpression(argument)) {
              report('undeclared-global', node, 'Unverifiable global assignment is prohibited.');
              continue;
            }
            for (const property of argument.properties) {
              const name =
                property.name &&
                (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
                  ? property.name.text
                  : undefined;
              if (!name || !approvedGlobal([...target, name]))
                report(
                  'undeclared-global',
                  node,
                  'Global assignment escapes the approved namespace.',
                );
            }
          }
      }
      if (globals.has(path[0] ?? '') && path.includes('*'))
        report('unverifiable-global', node, 'Computed global calls require an audited adapter.');
      if (['isODC', 'isO11', 'detectPlatform'].includes(member ?? ''))
        report('runtime-target-branch', node, 'Resolve platform differences at build time.');
    }
    if (
      ts.isImportDeclaration(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier) ||
      (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword)
    )
      report('unresolved-module', node, 'Production scripts must be self-contained.');
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    )
      inspectWrite(node.left, node.right, node);
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)
    )
      inspectWrite(node.operand, undefined, node);
    if (ts.isDeleteExpression(node)) inspectWrite(node.expression, undefined, node);
    if (
      ts.isIdentifier(node) &&
      ['process', 'Buffer', '__dirname', '__filename', 'module', 'exports'].includes(node.text) &&
      !declared.has(node.text) &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) &&
      !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)
    )
      report('node-runtime', node, 'Node runtime APIs cannot appear in browser output.');
    ts.forEachChild(node, visit);
  };
  visit(file);
  return findings;
}

export function scanCssResources(
  source: string,
  manifest: ComponentManifest,
  assetPath = '',
): Diagnostic[] {
  const findings: Diagnostic[] = [];
  const inspect = (url: string, path: string): void => {
    if (/^(?:data|javascript|blob):/i.test(url)) {
      findings.push({
        code: 'undeclared-inline-asset',
        path,
        message: 'Inline stylesheet resources require an explicit approved capability.',
      });
      return;
    }
    const resolved =
      assetPath && !/^[a-z]+:/i.test(url)
        ? new URL(url, `https://osai.invalid/${assetPath}`).pathname.slice(1)
        : url;
    const declared = manifest.assets.some(
      (asset) =>
        asset.path === resolved ||
        (asset.origin && `${asset.origin}/${asset.path.replace(/^\//, '')}` === url),
    );
    if (!declared)
      findings.push({
        code: 'undeclared-style-resource',
        path,
        message: 'Stylesheet resource is not declared by exact path.',
      });
  };
  let sheet: postcss.Root;
  try {
    sheet = postcss.parse(source);
  } catch {
    return [{ code: 'invalid-stylesheet', path: '/styles', message: 'Stylesheet parsing failed.' }];
  }
  sheet.walkDecls((declaration) => {
    for (const match of declaration.value.matchAll(
      /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi,
    ))
      inspect(
        match[1] ?? match[2] ?? match[3] ?? '',
        `/styles/${declaration.source?.start?.line ?? 0}`,
      );
    if (/expression\s*\(/i.test(declaration.value))
      findings.push({
        code: 'inline-execution',
        path: '/styles',
        message: 'Executable CSS expressions are prohibited.',
      });
  });
  sheet.walkAtRules('import', (rule) => {
    const match = /^(?:url\(\s*)?["']?([^"'\s)]+)/.exec(rule.params);
    if (match?.[1]) inspect(match[1], `/styles/${rule.source?.start?.line ?? 0}`);
    else
      findings.push({
        code: 'unverifiable-resource',
        path: '/styles',
        message: 'Stylesheet imports must have a declared literal URL.',
      });
  });
  return findings;
}
