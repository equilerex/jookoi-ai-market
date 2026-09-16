# jookoi-fastled

An LLM skill for writing FastLED animations that look good to a human eye.

## What it is

I build addressable LED installations and sound-reactive wearables on ESP32 as a hobby. Over time I collected a pile of notes on what makes an animation read well to a person, as opposed to just compiling. This skill is that material, packaged so Claude loads it before it writes LED code. I put it together with the `skill-creator` skill.

## Why

LLM-written LED code is reliably ugly. It compiles, it runs, and it looks wrong. Full white, everything at saturation 255, six hues at once, `delay()` in the loop. None of that is an API error, so nothing catches it.

FastLED documents its API and not its aesthetics. The reference tells you `fill_rainbow` takes a starting hue and a delta. It does not tell you that `255 / NUM_LEDS` truncates to zero past 255 LEDs, or that a `deltahue` of 5 reads fine on 30 LEDs and wrong on 300.

## Where the material came from

The aesthetic rules come from research pass i ran online a while back that seeked answers to what makes an animation read well to a person along with samples from my own projects.
various sources gathered from a lot of people online. sadly misplaced the original docs with credits, will keep my eye out for them.  

The API details came from FastLED itself. ai-checked every name, signature, and default against the source tree at `df106dfe6a` and against the `cookbook` folder in the same repo.

The examples came from my own projects, GlitchGlimmer mostly, a sound-reactive ESP32 device. No API from it or from my other projects appears in the skill, everything in it resolves against upstream FastLED.

## What's in it

`SKILL.md` has the rules that apply everywhere (no `delay()`, guard your pins, cap power, check what already ships before writing an effect) and routes to eight reference files.

| File | Covers |
|---|---|
| `core-loop.md` | Frame pacing, blocking vs non-blocking, brightness, power, FPS |
| `color.md` | Palettes, gradients, blending, gamma, color temperature |
| `motion.md` | Sine, beats, noise, easing, speed control, mapping |
| `patterns-1d.md` | Fades, chases, rainbows, fills, segments, blur |
| `matrix-2d.md` | Coordinate mapping, 2D noise, blur, drawing |
| `effects.md` | Shipped effects and audio detectors, indexed by name |
| `look-and-feel.md` | Why an effect reads as harsh, flat, or cheap, and what to do about it |
| `rhythm-and-audio.md` | Smoothing, attack/release, normalization, beat detection, phase, state changes |

## What it isn't

Not a hardware guide. Wiring, level shifting, power sizing, and chip selection are separate problems. This assumes the strip works.

Not a rulebook. Animation is exploratory. `look-and-feel.md` says so, because a checklist that produces generic output has failed at its own job.

## Install

```
/plugin marketplace add equilerex/jookoi-ai-market
/plugin install jookoi-dev@jookoi-ai-market
```

It triggers on any request about LED effects, strips, matrices, or animation code, including reviewing and debugging existing sketches.

## License

UNLICENSED. Personal toolkit, shared in case it's useful.
