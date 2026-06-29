export class TorchController {
  private stream: MediaStream | null = null;
  private track: MediaStreamTrack | null = null;
  private _supported = false;
  private _initialized = false;

  async init(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
      if (!caps.torch) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      this.stream = stream;
      this.track = track;
      this._supported = true;
      this._initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  async setTorch(on: boolean): Promise<void> {
    if (!this._supported || !this.track) return;
    try {
      await this.track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
    } catch {
      // Ignore: torch may not be supported mid-session
    }
  }

  get supported(): boolean {
    return this._supported;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.track = null;
    this._initialized = false;
    this._supported = false;
  }
}
