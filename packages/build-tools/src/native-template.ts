import { transformSync } from 'esbuild';
import ts from 'typescript';
import type { ComponentManifest } from '@osai/contract-schemas';
import { odcNodeNames, odcTemplate } from '@osai/adapter-schema';
import type { ResourceMetadata } from '@osai/adapter-schema';

export interface NativeNode {
  name: string;
  visibility: 'public' | 'private';
  inputs: string[];
  outputs: string[];
  source: string;
  bindings: Record<string, string>;
}
export interface NativeImplementation {
  template: 'odc-block@1.0';
  namespace: string;
  stateNamespace: string;
  nodes: NativeNode[];
  forwarders: Omit<NativeNode, 'source'>[];
  slots: { name: string; purpose: string }[];
  lifecycle: Record<'ready' | 'parametersChanged' | 'render' | 'destroy', string[]>;
  loadOrder: string[];
  resources: { id: string; path: string; kind: string; integrity: string; slot: string }[];
  readBack: { key: string; kind: 'source' | 'wiring' | 'resource' }[];
}

const quoted = JSON.stringify;
const identifier = /^[A-Za-z][A-Za-z0-9_]*$/;
function names(values: string[], context: string): void {
  const used = new Set<string>();
  for (const value of values) {
    if (!identifier.test(value) || used.has(value.toLowerCase()))
      throw new Error(`Unsupported or colliding native ${context}: ${value}`);
    used.add(value.toLowerCase());
  }
}
const failure = (code: string) =>
  `JSON.stringify({contractVersion:'1.0',ok:false,code:${quoted(code)},message:${quoted(code)}})`;

/** All state belongs to a template/component/version and is removed on disposal. */
function runtime(manifest: ComponentManifest, resources: ResourceMetadata, namespace: string) {
  const parent = namespace.split('.').slice(0, -1).join('.');
  const key = `${manifest.componentId}@${manifest.version}`;
  const events = Object.keys(manifest.events);
  return `
var bridge = window.${namespace};
var owner = window.${parent};
var registry = owner.nativeAdaptersV1 || (owner.nativeAdaptersV1 = Object.create(null));
var pool = registry[${quoted(key)}] || {instances:Object.create(null),styles:Object.create(null)};
function response(ok, code, value) { return JSON.stringify({contractVersion:'1.0',ok:ok,code:code,message:code,value:value===undefined?null:value}); }
function diagnostic(state, envelope) {
  if (state.disposed) return;
  var value = JSON.parse(envelope);
  var payload = JSON.stringify({instanceId:state.id,code:value.code,message:value.message});
  try { ${events.includes('error') ? 'state.actions.Forward_error(payload);' : 'state.actions.NativeDiagnostic(payload);'} } catch (_) { state.diagnostic=payload; }
}
function callbacks(state) {
  ${events
    .map(
      (event) => `
  var registered = JSON.parse(bridge.registerCallback(state.id, ${quoted(event)}, function(text) {
    if (!state.disposed) {
      var envelope = JSON.parse(text);
      state.actions.Forward_${event}(JSON.stringify(envelope.value.payload));
    }
  }));
  if (!registered.ok) throw new Error(registered.code);
  state.subscriptions.push(registered.value.subscriptionId);
  `,
    )
    .join('\n')}
}
function unsubscribe(state) {
  state.subscriptions.forEach(function(id) { bridge.unregisterCallback(state.id,id); });
  state.subscriptions=[];
}
function clean(state) {
  state.disposed=true;
  unsubscribe(state);
  state.cancels.splice(0).forEach(function(cancel) { cancel(); });
  state.styles.splice(0).forEach(function(key) {
    var style=pool.styles[key];
    if (style && --style.users===0) {
      style.detach(); style.link.remove(); delete pool.styles[key];
    }
  });
  if (state.host && state.host.getAttribute('data-osai-instance-id')===state.id) state.host.removeAttribute('data-osai-instance-id');
  delete pool.instances[state.id];
  if (!Object.keys(pool.instances).length && !Object.keys(pool.styles).length) delete registry[${quoted(key)}];
}
function create(state, config) {
  var result=bridge.create(${quoted(manifest.componentId)},state.id,state.containerId,config);
  if (!JSON.parse(result).ok) return result;
  try { callbacks(state); }
  catch (_) { unsubscribe(state); bridge.dispose(state.id); return response(false,'callback-registration-failed'); }
  state.config=config; state.ready=true;
  state.host.setAttribute('data-osai-instance-id',state.id);
  return result;
}
function style(state, asset, mapping, complete) {
  var key=mapping.url+'|'+asset.integrity;
  var entry=pool.styles[key];
  if (!entry) {
    var link=document.createElement('link');
    link.rel='stylesheet'; link.integrity=asset.integrity; link.crossOrigin='anonymous'; link.href=mapping.url;
    entry={link:link,users:0,status:'loading',waiters:[],detach:function(){link.removeEventListener('load',loaded);link.removeEventListener('error',failed);}};
    function finish(ok) {
      if(entry.status!=='loading') return;
      entry.status=ok?'loaded':'failed'; entry.detach();
      entry.waiters.splice(0).forEach(function(waiter){waiter(ok);});
    }
    function loaded(){finish(true);} function failed(){finish(false);}
    link.addEventListener('load',loaded);link.addEventListener('error',failed);
    pool.styles[key]=entry;
  }
  entry.users++; state.styles.push(key);
  if(entry.status==='loaded') {complete(true);return;}
  if(entry.status==='failed') {complete(false);return;}
  var listener=function(ok){if(!state.disposed)complete(ok);};
  entry.waiters.push(listener);
  state.cancels.push(function(){var i=entry.waiters.indexOf(listener);if(i>=0)entry.waiters.splice(i,1);});
  if(!entry.link.isConnected)document.head.appendChild(entry.link);
}
function loadStyles(state, mappings, done) {
  var assets=${quoted(resources.assets.filter((asset) => asset.type === 'style').sort((a, b) => resources.loadOrder.indexOf(a.path) - resources.loadOrder.indexOf(b.path)))};
  function next(index) {
    if(state.disposed)return;
    if(index===assets.length){done(true);return;}
    var asset=assets[index], mapping=mappings[asset.id];
    if(!mapping){done(false);return;}
    style(state,asset,mapping,function(ok){if(ok)next(index+1);else done(false);});
  }
  next(0);
}
`;
}

export function generateOdcImplementation(
  manifest: ComponentManifest,
  resources: ResourceMetadata,
  namespace: string,
): NativeImplementation {
  if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(namespace))
    throw new Error('Unsupported native bridge namespace');
  names(Object.keys(manifest.properties), 'input');
  names(Object.keys(manifest.commands), 'command');
  names(Object.keys(manifest.events), 'event');
  for (const property of Object.values(manifest.properties)) {
    const types = Array.isArray(property.schema.type)
      ? property.schema.type
      : [property.schema.type];
    if (
      types.some(
        (type) =>
          type !== undefined &&
          !['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'].includes(type),
      )
    )
      throw new Error('Unsupported native schema mapping');
  }
  const commands = Object.keys(manifest.commands);
  const events = Object.keys(manifest.events);
  const nodes: NativeNode[] = [];
  const add = (
    name: string,
    visibility: NativeNode['visibility'],
    inputs: string[],
    outputs: string[],
    source: string,
    bindings: Record<string, string> = {},
  ) => {
    nodes.push({
      name,
      visibility,
      inputs,
      outputs,
      source: transformSync(
        `${outputs
          .map((output) => {
            const [name, type] = output.split(':');
            return `$parameters.${name}=${type === 'Boolean' ? 'false' : "''"};`;
          })
          .join(
            '\n',
          )}\ntry {\n${source}\n} catch (_) { ${outputs.includes('EnvelopeJson:Text') ? `$parameters.EnvelopeJson=${failure('native-adapter-error')};` : "throw new Error('native-adapter-error');"} }`,
        { loader: 'js', target: 'es2017', legalComments: 'none' },
      ).code,
      bindings: {
        ...Object.fromEntries(
          inputs.map((input) => [input.split(':')[0]!, `Action.Input.${input.split(':')[0]}`]),
        ),
        ...bindings,
      },
    });
  };
  const wrapper = (name: string, inputs: string[], method: string, argumentsText: string) =>
    add(
      name,
      'public',
      inputs,
      ['EnvelopeJson:Text'],
      `var bridge=window.${namespace}; $parameters.EnvelopeJson=bridge?bridge.${method}(${argumentsText}):${failure('bundle-not-loaded')};`,
    );
  wrapper(
    'RegisterResources',
    ['RegistrationJson:Text'],
    'registerResources',
    `${quoted(manifest.componentId)},$parameters.RegistrationJson`,
  );
  wrapper(
    'Create',
    ['InstanceId:Text', 'ContainerId:Text', 'ConfigJson:Text'],
    'create',
    `${quoted(manifest.componentId)},$parameters.InstanceId,$parameters.ContainerId,$parameters.ConfigJson`,
  );
  wrapper(
    'Update',
    ['InstanceId:Text', 'ConfigJson:Text'],
    'update',
    '$parameters.InstanceId,$parameters.ConfigJson',
  );
  for (const command of commands)
    wrapper(
      `Command_${command}`,
      ['InstanceId:Text', 'ArgumentsJson:Text'],
      'invoke',
      `$parameters.InstanceId,${quoted(command)},$parameters.ArgumentsJson`,
    );
  wrapper(
    'UnregisterCallback',
    ['InstanceId:Text', 'SubscriptionId:Text'],
    'unregisterCallback',
    '$parameters.InstanceId,$parameters.SubscriptionId',
  );
  const prelude = runtime(manifest, resources, namespace);
  add(
    'Dispose',
    'public',
    ['InstanceId:Text'],
    ['EnvelopeJson:Text'],
    `${prelude}
var state=pool.instances[$parameters.InstanceId]; if(state)clean(state);
$parameters.EnvelopeJson=bridge.dispose($parameters.InstanceId);`,
  );
  const inputs = Object.entries(manifest.properties).filter(([, p]) => p.access !== 'read');
  const primitive = (type: unknown) =>
    typeof type === 'string' && ['string', 'boolean', 'integer', 'number'].includes(type);
  const native = (type: unknown) =>
    type === 'string'
      ? 'Text'
      : type === 'boolean'
        ? 'Boolean'
        : type === 'integer'
          ? 'Long Integer'
          : type === 'number'
            ? 'Decimal'
            : 'Text';
  add(
    'BuildConfiguration',
    'private',
    inputs.map(([name, p]) => `Input_${name}:${native(p.schema.type)}`),
    ['ConfigJson:Text', 'EnvelopeJson:Text'],
    `
$parameters.ConfigJson='';
try {
  var config={};
  ${inputs.map(([name, p]) => `if($parameters.Input_${name}!==undefined)config[${quoted(name)}]=${primitive(p.schema.type) ? `$parameters.Input_${name}` : `JSON.parse($parameters.Input_${name})`};`).join('\n')}
  $parameters.ConfigJson=JSON.stringify(config); $parameters.EnvelopeJson=JSON.stringify({contractVersion:'1.0',ok:true,code:'configuration-serialized',message:'configuration-serialized'});
}catch(_){$parameters.EnvelopeJson=${failure('invalid-json')};}`,
    Object.fromEntries(inputs.map(([name]) => [`Input_${name}`, `Block.Input.${name}`])),
  );
  const actionBindings = Object.fromEntries(
    events.map((event) => [`Forward_${event}`, `Block.Event.${event}(PayloadJson)`]),
  );
  if (!events.includes('error'))
    actionBindings.NativeDiagnostic = 'Block.Local.LastDiagnostic=PayloadJson';
  add(
    'BuildResources',
    'private',
    resources.assets.map((_, index) => `Asset_${index}:Text`),
    ['AssetMappingsJson:Text', 'RegistrationJson:Text'],
    `
var mappings={};
${resources.assets.map((asset, index) => `mappings[${quoted(asset.id)}]={url:$parameters.Asset_${index},integrity:${quoted(asset.integrity)}};`).join('\n')}
$parameters.AssetMappingsJson=JSON.stringify(mappings);
var registered={};
${resources.registration.assets.map((asset) => `registered[${quoted(asset.id)}]=mappings[${quoted(asset.id)}];`).join('\n')}
$parameters.RegistrationJson=JSON.stringify({schemaVersion:'2.0',releaseId:${quoted(resources.registration.releaseId)},mappings:registered});`,
    Object.fromEntries(
      resources.assets.map((asset, index) => [`Asset_${index}`, `slot:resource:${asset.id}`]),
    ),
  );
  add(
    'Ready',
    'private',
    [
      'InstanceId:Text',
      'ContainerId:Text',
      'ConfigJson:Text',
      'RegistrationJson:Text',
      'AssetMappingsJson:Text',
    ],
    ['EnvelopeJson:Text'],
    `${prelude}
var id=$parameters.InstanceId, host=document.getElementById($parameters.ContainerId);
$parameters.EnvelopeJson=response(false,'host-unavailable');
if(host && !pool.instances[id] && !host.hasAttribute('data-osai-instance-id')) {
  var mappings=JSON.parse($parameters.AssetMappingsJson), assets=${quoted(resources.assets)};
  if(!mappings || Array.isArray(mappings) || Object.keys(mappings).length!==assets.length)throw new Error('invalid-resource-mapping');
  assets.forEach(function(asset){
    var mapping=mappings[asset.id];
    if(!mapping || mapping.integrity!==asset.integrity || typeof mapping.url!=='string')throw new Error('invalid-resource-mapping');
    var url=new URL(mapping.url,document.baseURI);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash||url.origin!==(asset.origin||new URL(document.baseURI).origin))throw new Error('disallowed-resource-origin');
  });
  var registration=bridge.registerResources(${quoted(manifest.componentId)},$parameters.RegistrationJson);
  $parameters.EnvelopeJson=registration;
  if(JSON.parse(registration).ok) {
    var state={id:id,host:host,containerId:$parameters.ContainerId,config:'',pending:$parameters.ConfigJson,ready:false,disposed:false,subscriptions:[],styles:[],cancels:[],actions:{${Object.keys(
      actionBindings,
    )
      .map((name) => `${name}:$actions.${name}`)
      .join(',')}}};
    registry[${quoted(`${manifest.componentId}@${manifest.version}`)}]=pool;
    pool.instances[id]=state;
    $parameters.EnvelopeJson=response(true,'loading');
    loadStyles(state,mappings,function(ok){
      if(state.disposed)return;
      var result=ok?create(state,state.pending):response(false,'css-load-error');
      if(!JSON.parse(result).ok){diagnostic(state,result);clean(state);}
    });
  }
} else if(pool.instances[id]) {$parameters.EnvelopeJson=response(false,'duplicate-instance');}
`,
    {
      InstanceId: 'Block.Local.InstanceId(unique per lifetime)',
      ContainerId: 'slot:HostContainerId',
      ConfigJson: 'BuildConfiguration.ConfigJson',
      RegistrationJson: 'BuildResources.RegistrationJson',
      AssetMappingsJson: 'BuildResources.AssetMappingsJson',
      ...actionBindings,
    },
  );
  add(
    'ApplyConfiguration',
    'private',
    ['InstanceId:Text', 'ConfigJson:Text'],
    ['EnvelopeJson:Text', 'RequiresRecreation:Boolean', 'AcceptedConfigJson:Text'],
    `${prelude}
var state=pool.instances[$parameters.InstanceId];
$parameters.RequiresRecreation=false; $parameters.AcceptedConfigJson=state?state.config:'';
$parameters.EnvelopeJson=response(false,'unknown-instance');
if(state && !state.disposed) {
  if(!state.ready) {state.pending=$parameters.ConfigJson;$parameters.EnvelopeJson=response(false,'instance-loading');}
  else if(state.config===$parameters.ConfigJson) {$parameters.EnvelopeJson=response(true,'unchanged');}
  else {
    var result=bridge.update(state.id,$parameters.ConfigJson);
    $parameters.RequiresRecreation=JSON.parse(result).code==='recreation-required';
    if($parameters.RequiresRecreation) {
      unsubscribe(state); var disposed=bridge.dispose(state.id); state.ready=false;
      result=JSON.parse(disposed).ok?create(state,$parameters.ConfigJson):disposed;
      if(!JSON.parse(result).ok){diagnostic(state,result);clean(state);}
    }
    if(JSON.parse(result).ok) {state.config=$parameters.ConfigJson;$parameters.AcceptedConfigJson=state.config;}
    else if(!state.disposed)diagnostic(state,result);
    $parameters.EnvelopeJson=result;
  }
}`,
    { InstanceId: 'Block.Local.InstanceId', ConfigJson: 'BuildConfiguration.ConfigJson' },
  );
  add(
    'ReadState',
    'private',
    ['InstanceId:Text'],
    ['EnvelopeJson:Text', 'AcceptedConfigJson:Text'],
    `${prelude}
var state=pool.instances[$parameters.InstanceId];
$parameters.AcceptedConfigJson=state?state.config:'';
$parameters.EnvelopeJson=response(!!state&&state.ready,state?(state.ready?'ready':'loading'):'unknown-instance');`,
  );
  add(
    'ResolveInstance',
    'private',
    ['RootId:Text'],
    ['InstanceId:Text', 'EnvelopeJson:Text'],
    `
$parameters.InstanceId='';
var root=document.getElementById($parameters.RootId), hosts=[];
if(root){if(root.matches('[data-osai-instance-id]'))hosts.push(root); hosts=hosts.concat(Array.from(root.querySelectorAll('[data-osai-instance-id]')));}
if(hosts.length===1){$parameters.InstanceId=hosts[0].getAttribute('data-osai-instance-id')||'';}
$parameters.EnvelopeJson=JSON.stringify({contractVersion:'1.0',ok:hosts.length===1&&!!$parameters.InstanceId,code:hosts.length===1?'instance-resolved':'instance-unresolved',message:'Scoped instance resolution'});
`,
    { RootId: 'slot:ConsumerBlockRootId' },
  );
  names(
    nodes.map((node) => node.name),
    'action',
  );
  const forwarders: Omit<NativeNode, 'source'>[] = events.map((event) => ({
    name: `Forward_${event}`,
    visibility: 'private',
    inputs: ['PayloadJson:Text'],
    outputs: [],
    bindings: { RaiseEvent: `Block.Event.${event}`, PayloadJson: 'Action.Input.PayloadJson' },
  }));
  if (!events.includes('error'))
    forwarders.push({
      name: 'NativeDiagnostic',
      visibility: 'private',
      inputs: ['PayloadJson:Text'],
      outputs: [],
      bindings: { Assign: 'Block.Local.LastDiagnostic', Value: 'Action.Input.PayloadJson' },
    });
  const implementation: NativeImplementation = {
    template: odcTemplate,
    namespace,
    stateNamespace: namespace.split('.').slice(0, -1).join('.') + '.nativeAdaptersV1',
    nodes,
    forwarders,
    slots: [
      { name: 'HostContainerId', purpose: 'Inspected empty host Container.Id' },
      { name: 'ConsumerBlockRootId', purpose: 'Intended consuming Block.Id' },
      ...resources.assets.map((asset) => ({
        name: `resource:${asset.id}`,
        purpose: 'Inspected imported resource URL; required scripts load before Ready',
      })),
    ],
    lifecycle: {
      ready: ['BuildConfiguration', 'branch on EnvelopeJson.ok', 'BuildResources', 'Ready'],
      parametersChanged: ['BuildConfiguration', 'branch on EnvelopeJson.ok', 'ApplyConfiguration'],
      render: ['BuildConfiguration', 'branch on EnvelopeJson.ok', 'ApplyConfiguration'],
      destroy: ['Dispose'],
    },
    // Native scripts are ready before this adapter runs; Ready registers URLs
    // and waits for its owned styles before creating the component.
    loadOrder: [
      ...resources.loadOrder.filter(
        (path) =>
          path !== 'registerResources' &&
          path !== 'create' &&
          !resources.assets.some((asset) => asset.type === 'style' && asset.path === path),
      ),
      'registerResources',
      ...resources.loadOrder.filter((path) =>
        resources.assets.some((asset) => asset.type === 'style' && asset.path === path),
      ),
      'create',
    ],
    resources: resources.assets.map((asset) => ({
      id: asset.id,
      path: asset.path,
      kind: asset.type,
      integrity: asset.integrity,
      slot: `resource:${asset.id}`,
    })),
    readBack: [
      ...nodes.flatMap((node) => [
        { key: `source:${node.name}`, kind: 'source' as const },
        { key: `wiring:${node.name}`, kind: 'wiring' as const },
      ]),
      ...forwarders.map((flow) => ({ key: `wiring:${flow.name}`, kind: 'wiring' as const })),
      { key: 'wiring:Block', kind: 'wiring' },
      ...resources.assets.map((asset) => ({
        key: `resource:${asset.id}`,
        kind: 'resource' as const,
      })),
    ],
  };
  if (JSON.stringify(nodes.map((n) => n.name)) !== JSON.stringify(odcNodeNames(manifest)))
    throw new Error('ODC guide/node contract drift');
  validateNativeImplementation(implementation);
  return implementation;
}

/** Independent static boundary oracle, in addition to generated-plan equality. */
export function validateNativeImplementation(implementation: NativeImplementation): void {
  if (implementation.template !== 'odc-block@1.0') throw new Error('Unknown native template');
  names(
    [...implementation.nodes, ...implementation.forwarders].map((node) => node.name),
    'action',
  );
  const arities: Record<string, number> = {
    registerResources: 2,
    create: 4,
    update: 2,
    invoke: 3,
    registerCallback: 3,
    unregisterCallback: 2,
    dispose: 1,
  };
  for (const node of [...implementation.nodes, ...implementation.forwarders]) {
    names(
      node.inputs.map((p) => p.split(':')[0]!),
      'parameter',
    );
    names(
      node.outputs.map((p) => p.split(':')[0]!),
      'output',
    );
    if (
      [...node.inputs, ...node.outputs].some(
        (p) => !['Text', 'Boolean', 'Long Integer', 'Decimal'].includes(p.split(':')[1]!),
      )
    )
      throw new Error('Unsupported native parameter type');
    if ([...node.inputs, ...node.outputs].some((input) => input.includes(':ClientAction')))
      throw new Error('Unsupported ClientAction-reference input');
    if (!('source' in node)) continue;
    if (typeof node.source !== 'string') throw new Error('Native source must be text');
    transformSync(node.source, { loader: 'js', target: 'es2017', legalComments: 'none' });
    const file = ts.createSourceFile(
      'native.js',
      node.source,
      ts.ScriptTarget.ES2017,
      true,
      ts.ScriptKind.JS,
    );
    const actionReferences = new Set<string>();
    const visit = (part: ts.Node): void => {
      if (ts.isIdentifier(part) && part.text === '$actions') {
        const access = part.parent;
        if (!ts.isPropertyAccessExpression(access) || access.expression !== part)
          throw new Error('Native actions require explicit named references');
        if (!implementation.forwarders.some((flow) => flow.name === access.name.text))
          throw new Error(`Unknown native action reference: ${access.name.text}`);
        actionReferences.add(access.name.text);
      }
      if (ts.isCallExpression(part) || ts.isNewExpression(part)) {
        const expression = part.expression,
          args = part.arguments ?? [];
        if (
          ts.isIdentifier(expression) &&
          ['eval', 'Function', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker'].includes(
            expression.text,
          )
        )
          throw new Error('Unsafe native executable');
        if (ts.isPropertyAccessExpression(expression)) {
          const owner = expression.expression.getText(file),
            method = expression.name.text;
          if (['eval', 'Function', 'fetch', 'write', 'insertAdjacentHTML'].includes(method))
            throw new Error('Unsafe native executable');
          if (owner === 'bridge' && Object.hasOwn(arities, method)) {
            if (args.length !== arities[method]) throw new Error('Wrong bridge argument count');
            const textPositions =
              method === 'create'
                ? [0, 1, 2, 3]
                : method === 'registerCallback'
                  ? [0, 1]
                  : args.map((_, i) => i);
            if (
              textPositions.some(
                (i) =>
                  args[i] &&
                  (ts.isObjectLiteralExpression(args[i]!) || ts.isArrayLiteralExpression(args[i]!)),
              )
            )
              throw new Error('Bridge requires JSON text');
          }
          if (
            (owner === '$actions' || owner === 'state.actions') &&
            (args.length !== 1 || args.some((arg) => ts.isObjectLiteralExpression(arg)))
          )
            throw new Error('Native event forwarding requires positional Text');
        }
      }
      if (
        ts.isBinaryExpression(part) &&
        ['innerHTML', 'outerHTML'].some((sink) => part.left.getText(file).endsWith('.' + sink))
      )
        throw new Error('Unsafe native HTML sink');
      ts.forEachChild(part, visit);
    };
    visit(file);
    if (node.name === 'Ready')
      for (const flow of implementation.forwarders)
        if (!actionReferences.has(flow.name))
          throw new Error(`Missing native action reference: ${flow.name}`);
  }
}
