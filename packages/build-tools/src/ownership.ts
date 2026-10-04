import ts from 'typescript';
import type { Diagnostic } from '@osai/contract-schemas';

/** Source-only rule: bundled platform code implements the managed allocation APIs. */
export function scanManagedAllocations(source: string): Diagnostic[] {
  const file = ts.createSourceFile(
    'component.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const diagnostics: Diagnostic[] = [];
  const aliases = new Map<string, ts.Expression>();
  const path = (node: ts.Expression, seen = new Set<string>()): string => {
    if (ts.isIdentifier(node)) {
      if (aliases.has(node.text) && !seen.has(node.text)) {
        seen.add(node.text);
        return path(aliases.get(node.text)!, seen);
      }
      return node.text;
    }
    if (ts.isPropertyAccessExpression(node))
      return `${path(node.expression, seen)}.${node.name.text}`;
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression))
      return `${path(node.expression, seen)}.${node.argumentExpression.text}`;
    if (ts.isParenthesizedExpression(node)) return path(node.expression, seen);
    return '';
  };
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      aliases.set(node.name.text, node.initializer);
    ts.forEachChild(node, collect);
  };
  collect(file);
  const report = (node: ts.Node, kind: string): void => {
    const position = file.getLineAndCharacterOfPosition(node.getStart(file));
    diagnostics.push({
      code: 'unmanaged-allocation',
      path: `/source/${position.line + 1}/${position.character + 1}`,
      message: `Use managed ownership for ${kind}.`,
    });
  };
  const managed = (node: ts.Node, kind: string): boolean => {
    const managedCall = (expression: ts.Expression, method: string): boolean =>
      new RegExp(`(?:^|\\.)(?:resources|scope)\\.${method}$`).test(
        expression.getText(file).replaceAll(' ', ''),
      );
    let parent = node.parent;
    // A constructor result may be captured and immediately adopted before any use.
    if (
      parent &&
      ts.isVariableDeclaration(parent) &&
      ts.isIdentifier(parent.name) &&
      ts.isVariableDeclarationList(parent.parent) &&
      ts.isVariableStatement(parent.parent.parent)
    ) {
      const statement = parent.parent.parent;
      const container = statement.parent;
      if (ts.isBlock(container) || ts.isSourceFile(container)) {
        const next = container.statements[container.statements.indexOf(statement) + 1];
        if (
          next &&
          ts.isExpressionStatement(next) &&
          ts.isCallExpression(next.expression) &&
          managedCall(next.expression.expression, kind) &&
          next.expression.arguments[0]?.getText(file) === parent.name.text
        )
          return true;
      }
    }
    if (parent && ts.isCallExpression(parent) && managedCall(parent.expression, kind)) return true;
    while (parent) {
      if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
        const call = parent.parent;
        if (
          ts.isCallExpression(call) &&
          managedCall(call.expression, 'adoptProvider') &&
          call.arguments[1] === parent
        ) {
          const contract = call.arguments[0];
          if (!contract || !ts.isObjectLiteralExpression(contract)) return false;
          const fields = new Map(
            contract.properties
              .filter(ts.isPropertyAssignment)
              .map((property) => [
                property.name.getText(file).replaceAll("'", '').replaceAll('"', ''),
                property.initializer,
              ]),
          );
          const capabilities = fields.get('capabilities');
          const plural =
            kind === 'worker'
              ? 'workers'
              : kind === 'observer'
                ? 'observers'
                : kind === 'portal'
                  ? 'portals'
                  : kind === 'listen'
                    ? 'listeners'
                    : 'timers';
          const obligations = [
            ['partialInitialization', 'register-cleanup-before-allocation'],
            ['update', 'transactional'],
            ['disposal', 'scope'],
          ];
          return Boolean(
            capabilities &&
            ts.isArrayLiteralExpression(capabilities) &&
            capabilities.elements.some(
              (element) => ts.isStringLiteralLike(element) && element.text === plural,
            ) &&
            obligations.every(([name, value]) => {
              const field = fields.get(name!);
              return field && ts.isStringLiteralLike(field) && field.text === value;
            }) &&
            /\b(?:scope|owner)\.add\s*\(/.test(parent.body.getText(file)),
          );
        }
      }
      parent = parent.parent;
    }
    return false;
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = path(node.expression);
      const last = name.split('.').at(-1);
      const kind =
        last === 'addEventListener'
          ? 'listen'
          : ['setTimeout', 'setInterval', 'requestAnimationFrame'].includes(last ?? '')
            ? 'timer'
            : /(?:document|ownerDocument)\.(?:body|head|documentElement)\.(?:append|appendChild|prepend|insertBefore|replaceChildren)$/.test(
                  name,
                )
              ? 'portal'
              : undefined;
      if (kind && !managed(node, kind)) report(node, kind);
    }
    if (ts.isNewExpression(node)) {
      const name = path(node.expression).split('.').at(-1);
      const kind =
        name === 'Worker' || name === 'SharedWorker'
          ? 'worker'
          : ['MutationObserver', 'ResizeObserver', 'IntersectionObserver'].includes(name ?? '')
            ? 'observer'
            : undefined;
      if (kind && !managed(node, kind)) report(node, kind);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return diagnostics;
}
