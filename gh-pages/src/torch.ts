export class TorchController {
  private stream: MediaStream | null = null;
  private track: MediaStreamTrack | null = null;
  private _supported = false;

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
      // Ignore
    }
  }

  get supported(): boolean {
    return this._supported;
  }

  release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.track = null;
    this._supported = false;
  }
}
