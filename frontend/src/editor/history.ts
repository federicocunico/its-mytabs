/**
 * Snapshot-based undo/redo. Each checkpoint stores the full score serialized
 * through alphaTab's JsonConverter — restoring re-runs the importer pipeline,
 * so every derived link (ties, chains, lookups) is recomputed correctly.
 * Inverse commands were rejected by design: finish() side effects are too
 * entangled to undo reliably (see docs/superpowers/specs/2026-07-05-gp-editor-design.md).
 */
import * as alphaTab from "@coderline/alphatab";

type Score = alphaTab.model.Score;
type Settings = alphaTab.Settings;

const { JsonConverter } = alphaTab.model;

export class SnapshotHistory {
    private undoStack: string[] = [];
    private redoStack: string[] = [];

    constructor(private readonly limit: number = 50) {}

    get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /** Record the current state BEFORE a mutation runs. Clears the redo stack. */
    checkpoint(score: Score): void {
        this.undoStack.push(JsonConverter.scoreToJson(score));
        if (this.undoStack.length > this.limit) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    /** Drop the most recent checkpoint (used when a transaction fails validation). */
    discardCheckpoint(): void {
        this.undoStack.pop();
    }

    undo(current: Score, settings: Settings): Score | null {
        const snapshot = this.undoStack.pop();
        if (snapshot === undefined) {
            return null;
        }
        this.redoStack.push(JsonConverter.scoreToJson(current));
        return JsonConverter.jsonToScore(snapshot, settings);
    }

    redo(current: Score, settings: Settings): Score | null {
        const snapshot = this.redoStack.pop();
        if (snapshot === undefined) {
            return null;
        }
        this.undoStack.push(JsonConverter.scoreToJson(current));
        return JsonConverter.jsonToScore(snapshot, settings);
    }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
}
