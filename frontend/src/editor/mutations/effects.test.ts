import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { loadTex, TEX_TWO_BARS, voice0 } from "../test-utils.ts";
import { BEND_PRESETS, setBeatEffect, setNoteEffect } from "./effects.ts";
import { normalizeScore } from "../normalize.ts";
import { EditorValidationError } from "../validation.ts";

const { VibratoType, HarmonicType, AccentuationType, SlideOutType, SlideInType, BendType, GraceType, PickStroke, BrushType, Duration, DynamicValue } = alphaTab.model;

// TEX_TWO_BARS bar 0 (model strings): 3@s4, 5@s4, 7@s3, 5@s5 | bar 1: 3@s4, 5@s4
function fixture() {
    const { score, settings } = loadTex(TEX_TWO_BARS);
    const beats = voice0(score, 0).beats;
    return { score, settings, beats, note: (i: number) => beats[i].notes[0] };
}

describe("note effects", () => {
    it("toggles simple boolean effects", () => {
        const { note } = fixture();
        const n = note(0);

        setNoteEffect(n, { kind: "palmMute", on: true });
        setNoteEffect(n, { kind: "letRing", on: true });
        setNoteEffect(n, { kind: "staccato", on: true });
        setNoteEffect(n, { kind: "ghost", on: true });

        expect(n.isPalmMute).toBe(true);
        expect(n.isLetRing).toBe(true);
        expect(n.isStaccato).toBe(true);
        expect(n.isGhost).toBe(true);

        setNoteEffect(n, { kind: "palmMute", on: false });
        expect(n.isPalmMute).toBe(false);
    });

    it("sets vibrato, accent, dynamics and harmonics", () => {
        const { note } = fixture();
        const n = note(0);

        setNoteEffect(n, { kind: "vibrato", type: VibratoType.Wide });
        expect(n.vibrato).toBe(VibratoType.Wide);

        setNoteEffect(n, { kind: "accent", type: AccentuationType.Heavy });
        expect(n.accentuated).toBe(AccentuationType.Heavy);

        setNoteEffect(n, { kind: "harmonic", type: HarmonicType.Artificial, value: 12 });
        expect(n.harmonicType).toBe(HarmonicType.Artificial);
        expect(n.harmonicValue).toBe(12);

        setNoteEffect(n, { kind: "dynamics", value: DynamicValue.FFF });
        expect(n.dynamics).toBe(DynamicValue.FFF);
    });

    it("dead note clears bend and harmonic", () => {
        const { note } = fixture();
        const n = note(0);
        setNoteEffect(n, { kind: "harmonic", type: HarmonicType.Natural });
        setNoteEffect(n, { kind: "bend", type: BendType.Bend, points: [{ offset: 0, value: 0 }, { offset: 60, value: 4 }] });

        setNoteEffect(n, { kind: "dead", on: true });

        expect(n.isDead).toBe(true);
        expect(n.harmonicType).toBe(HarmonicType.None);
        expect(n.bendType).toBe(BendType.None);
    });

    it("hammer-on requires a next note on the same string", () => {
        const { score, settings, note, beats } = fixture();

        setNoteEffect(note(0), { kind: "hammerPull", on: true }); // 3@s4 -> 5@s4 ok
        normalizeScore(score, settings, [beats[0].voice.bar]);
        expect(note(0).isHammerPullOrigin).toBe(true);
        expect(note(0).hammerPullDestination).not.toBeNull();

        // 5@s5 (beat 3) has no following note on string 5
        expect(() => setNoteEffect(note(3), { kind: "hammerPull", on: true })).toThrow(EditorValidationError);
    });

    it("shift/legato slides require a next note on the same string; slide-outs do not", () => {
        const { note } = fixture();

        setNoteEffect(note(0), { kind: "slideOut", type: SlideOutType.Shift });
        expect(note(0).slideOutType).toBe(SlideOutType.Shift);

        expect(() => setNoteEffect(note(3), { kind: "slideOut", type: SlideOutType.Legato })).toThrow(EditorValidationError);

        setNoteEffect(note(3), { kind: "slideOut", type: SlideOutType.OutDown });
        expect(note(3).slideOutType).toBe(SlideOutType.OutDown);

        setNoteEffect(note(1), { kind: "slideIn", type: SlideInType.IntoFromBelow });
        expect(note(1).slideInType).toBe(SlideInType.IntoFromBelow);
    });

    it("applies bend presets with correct points", () => {
        const { note } = fixture();
        const n = note(0);
        const full = BEND_PRESETS.find((p) => p.id === "bend-full")!;

        setNoteEffect(n, { kind: "bend", type: full.type, points: full.points });

        expect(n.bendType).toBe(BendType.Bend);
        expect(n.bendPoints!.length).toBe(2);
        expect(n.bendPoints![1].value).toBe(4);
    });

    it("trill requires a different fret", () => {
        const { note } = fixture();
        setNoteEffect(note(0), { kind: "trill", fret: 5, speed: Duration.Sixteenth });
        expect(note(0).trillValue).toBeGreaterThan(0);

        expect(() => setNoteEffect(note(1), { kind: "trill", fret: 5, speed: Duration.Sixteenth })).toThrow(EditorValidationError);
    });

    it("tie destinations reject new bends", () => {
        const { score, settings, beats } = fixture();
        const dest = beats[1].notes[0];
        dest.isTieDestination = true;
        normalizeScore(score, settings, [beats[1].voice.bar]);

        expect(() => setNoteEffect(dest, { kind: "bend", type: BendType.Bend, points: [{ offset: 0, value: 0 }, { offset: 60, value: 4 }] }))
            .toThrow(EditorValidationError);
    });
});

describe("beat effects", () => {
    it("sets tap/slap/pop, pick stroke, brush, text and tremolo", () => {
        const { beats } = fixture();
        const beat = beats[0];

        setBeatEffect(beat, { kind: "tap", on: true });
        expect(beat.tap).toBe(true);

        setBeatEffect(beat, { kind: "pickStroke", type: PickStroke.Down });
        expect(beat.pickStroke).toBe(PickStroke.Down);

        setBeatEffect(beat, { kind: "brush", type: BrushType.BrushDown });
        expect(beat.brushType).toBe(BrushType.BrushDown);

        setBeatEffect(beat, { kind: "text", value: "P.M." });
        expect(beat.text).toBe("P.M.");

        setBeatEffect(beat, { kind: "tremolo", speed: Duration.Sixteenth });
        expect(beat.tremoloSpeed).toBe(Duration.Sixteenth);
        setBeatEffect(beat, { kind: "tremolo", speed: null });
        expect(beat.tremoloSpeed == null).toBe(true);
    });

    it("turns the beat into a grace beat", () => {
        const { beats } = fixture();
        setBeatEffect(beats[0], { kind: "grace", type: GraceType.BeforeBeat });
        expect(beats[0].graceType).toBe(GraceType.BeforeBeat);
    });
});

describe("effects survive Gp7 export round-trip", () => {
    it("exports and reimports the main effects", () => {
        const { score, settings, beats, note } = fixture();

        setNoteEffect(note(0), { kind: "palmMute", on: true });
        setNoteEffect(note(0), { kind: "hammerPull", on: true });
        setNoteEffect(note(1), { kind: "vibrato", type: VibratoType.Slight });
        setNoteEffect(note(1), { kind: "bend", type: BendType.Bend, points: [{ offset: 0, value: 0 }, { offset: 60, value: 4 }] });
        setNoteEffect(note(2), { kind: "harmonic", type: HarmonicType.Natural });
        // slide needs a following note on the same string: bar 1 beat 0 (3@s4) -> bar 1 beat 1 (5@s4)
        const bar1note = voice0(score, 1).beats[0].notes[0];
        setNoteEffect(bar1note, { kind: "slideOut", type: SlideOutType.Shift });
        setBeatEffect(beats[3], { kind: "tremolo", speed: Duration.Sixteenth });
        normalizeScore(score, settings, [beats[0].voice.bar]);

        const bytes = new alphaTab.exporter.Gp7Exporter().export(score, settings);
        const reloaded = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
        const rBeats = reloaded.tracks[0].staves[0].bars[0].voices[0].beats;

        expect(rBeats[0].notes[0].isPalmMute).toBe(true);
        expect(rBeats[0].notes[0].isHammerPullOrigin).toBe(true);
        expect(rBeats[1].notes[0].vibrato).toBe(VibratoType.Slight);
        expect(rBeats[1].notes[0].bendType).toBe(BendType.Bend);
        expect(rBeats[1].notes[0].bendPoints![1].value).toBe(4);
        expect(rBeats[2].notes[0].harmonicType).toBe(HarmonicType.Natural);
        expect(rBeats[3].tremoloSpeed).toBe(Duration.Sixteenth);
        const rBar1 = reloaded.tracks[0].staves[0].bars[1].voices[0].beats;
        expect(rBar1[0].notes[0].slideOutType).toBe(SlideOutType.Shift);
    });
});
