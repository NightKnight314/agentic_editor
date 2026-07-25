# Standalone effects reference

This directory is an executable reference for the contracts in `design/effects-system.md`. It does not mutate editor state and is intentionally independent of React.

Run the tests:

```sh
node --test scripts/effects/*.test.mjs
```

Compile the checked fixture into a normalized render plan and FFmpeg plan:

```sh
node scripts/effects/compile-demo.mjs fixtures/effects/demo-plan.json
```

Render it to a new file (the script refuses to overwrite):

```sh
node scripts/effects/render-demo.mjs fixtures/effects/demo-plan.json /tmp/nighthack-effects-demo.mp4
```

The reference demonstrates:

- a closed, versioned effect registry;
- strict parameters, local half-open ranges, and keyframes;
- deterministic hashing and content-derived plan IDs;
- composition-frame to source-frame mapping for constant speed;
- ordered evaluation of transform, blur, color, and vignette;
- deterministic music-ducking automation;
- FFmpeg filtergraph planning without executing shell input.

`render-demo.mjs` invokes the installed `ffmpeg-static` binary with an argument array; model-authored strings never become shell or filter expressions. The checked adapter currently marks animated blur plus color/vignette lowering as approximate in its diagnostics. The fixture generates a music-ducking envelope but deliberately does not apply it: there is no licensed music bus in the fixture, and attenuating the only dialogue stream would be incorrect.

It is not a production renderer. The editor integration should preserve the proposal/revision authority boundary, capability-probe the installed FFmpeg build, and compare approval previews with encoded output.
