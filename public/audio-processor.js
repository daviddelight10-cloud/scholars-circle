class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 640; // 40ms at 16kHz — consistent chunk cadence for VAD accuracy
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];
        
        if (this.bufferIndex >= this.bufferSize) {
          // Send the full buffer to the main thread
          this.port.postMessage(this.buffer);
          // Reset buffer
          this.buffer = new Float32Array(this.bufferSize);
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
