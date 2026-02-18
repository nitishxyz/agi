#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 44100;
const outDir = join(import.meta.dir, '../public/sfx');
mkdirSync(outDir, { recursive: true });

function writeWav(name: string, samples: Float32Array) {
	const n = samples.length;
	const buf = Buffer.alloc(44 + n * 2);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + n * 2, 4);
	buf.write('WAVE', 8);
	buf.write('fmt ', 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(RATE, 24);
	buf.writeUInt32LE(RATE * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(n * 2, 40);
	for (let i = 0; i < n; i++) {
		const s = Math.max(-1, Math.min(1, samples[i]));
		buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
	}
	const path = join(outDir, `${name}.wav`);
	writeFileSync(path, buf);
	console.log(
		`  ✓ ${name}.wav (${(buf.length / 1024).toFixed(1)}KB, ${(n / RATE).toFixed(2)}s)`,
	);
}

function sine(phase: number): number {
	return Math.sin(2 * Math.PI * phase);
}

function softNoise(): number {
	return ((Math.random() + Math.random() + Math.random()) / 3) * 2 - 1;
}

console.log('Generating gentle sound effects...\n');

// 1. Chime — soft glass bell, like a raindrop hitting crystal
{
	const dur = 1.5;
	const samples = new Float32Array(Math.ceil(RATE * dur));
	for (let i = 0; i < samples.length; i++) {
		const t = i / RATE;
		const attack = Math.min(t / 0.02, 1);
		const decay = Math.exp(-t * 2.2);
		const f = 523.25;
		const s =
			sine(f * t) * 0.35 +
			sine(f * 2 * t) * 0.15 * Math.exp(-t * 4) +
			sine(f * 3 * t) * 0.06 * Math.exp(-t * 6) +
			sine(f * 0.5 * t) * 0.12 * Math.exp(-t * 1.5);
		samples[i] = s * attack * decay * 0.5;
	}
	writeWav('chime', samples);
}

// 2. Whoosh up — breathy air, very gentle rising sweep
{
	const dur = 0.6;
	const samples = new Float32Array(Math.ceil(RATE * dur));
	let lpState = 0;
	for (let i = 0; i < samples.length; i++) {
		const t = i / RATE;
		const p = t / dur;
		const amp = Math.sin(p * Math.PI);
		const cutoff = 0.02 + 0.08 * p;
		const noise = softNoise();
		lpState += cutoff * (noise - lpState);
		const tone = sine((120 + 200 * p * p) * t) * 0.1 * amp;
		samples[i] = (lpState * amp * 0.6 + tone) * 0.3;
	}
	writeWav('whoosh-up', samples);
}

// 3. Whoosh down — gentle falling air
{
	const dur = 0.6;
	const samples = new Float32Array(Math.ceil(RATE * dur));
	let lpState = 0;
	for (let i = 0; i < samples.length; i++) {
		const t = i / RATE;
		const p = t / dur;
		const amp = Math.sin(p * Math.PI);
		const cutoff = 0.1 - 0.08 * p;
		const noise = softNoise();
		lpState += Math.max(0.005, cutoff) * (noise - lpState);
		const tone = sine((320 - 200 * p * p) * t) * 0.1 * amp;
		samples[i] = (lpState * amp * 0.6 + tone) * 0.3;
	}
	writeWav('whoosh-down', samples);
}

// 4. Slide — soft horizontal swish
{
	const dur = 0.45;
	const samples = new Float32Array(Math.ceil(RATE * dur));
	let lpState = 0;
	for (let i = 0; i < samples.length; i++) {
		const t = i / RATE;
		const p = t / dur;
		const amp = Math.sin(p * Math.PI);
		const cutoff = 0.03 + 0.04 * Math.sin(p * Math.PI);
		const noise = softNoise();
		lpState += cutoff * (noise - lpState);
		const tone = sine(260 * t) * 0.08 * amp * Math.exp(-t * 3);
		samples[i] = (lpState * amp * 0.5 + tone) * 0.25;
	}
	writeWav('slide', samples);
}

// 5. Pop — water droplet, soft and round
{
	const dur = 0.4;
	const samples = new Float32Array(Math.ceil(RATE * dur));
	for (let i = 0; i < samples.length; i++) {
		const t = i / RATE;
		const attack = Math.min(t / 0.008, 1);
		const decay = Math.exp(-t * 8);
		const freqDrop = 440 * Math.exp(-t * 15) + 220;
		const s =
			sine(freqDrop * t) * 0.5 +
			sine(freqDrop * 2.02 * t) * 0.15 * Math.exp(-t * 12);
		samples[i] = s * attack * decay * 0.35;
	}
	writeWav('pop', samples);
}

// 6. Pop small — tiny water bead
{
	const dur = 0.2;
	const samples = new Float32Array(Math.ceil(RATE * dur));
	for (let i = 0; i < samples.length; i++) {
		const t = i / RATE;
		const attack = Math.min(t / 0.005, 1);
		const decay = Math.exp(-t * 14);
		const freqDrop = 600 * Math.exp(-t * 20) + 350;
		samples[i] = sine(freqDrop * t) * attack * decay * 0.25;
	}
	writeWav('pop-small', samples);
}

// 7. Tick — gentle tap, like a pebble in water
{
	const dur = 0.15;
	const samples = new Float32Array(Math.ceil(RATE * dur));
	for (let i = 0; i < samples.length; i++) {
		const t = i / RATE;
		const attack = Math.min(t / 0.003, 1);
		const decay = Math.exp(-t * 20);
		const freq = 800 * Math.exp(-t * 30) + 400;
		const s =
			sine(freq * t) * 0.4 + sine(freq * 1.5 * t) * 0.1 * Math.exp(-t * 30);
		samples[i] = s * attack * decay * 0.2;
	}
	writeWav('tick', samples);
}

// 8. Success — two gentle glass tones, ascending
{
	const dur = 0.9;
	const samples = new Float32Array(Math.ceil(RATE * dur));
	for (let i = 0; i < samples.length; i++) {
		const t = i / RATE;
		const a1 = Math.min(t / 0.02, 1) * Math.exp(-t * 3);
		const t2 = Math.max(0, t - 0.15);
		const a2 = t > 0.15 ? Math.min(t2 / 0.02, 1) * Math.exp(-t2 * 2.5) : 0;
		const f1 = 392;
		const f2 = 523.25;
		const s =
			(sine(f1 * t) * 0.3 + sine(f1 * 2 * t) * 0.08) * a1 +
			(sine(f2 * t) * 0.35 + sine(f2 * 2 * t) * 0.1 + sine(f2 * 3 * t) * 0.03) *
				a2;
		samples[i] = s * 0.45;
	}
	writeWav('success', samples);
}

// 9. Scale pop — soft bloom/expansion
{
	const dur = 0.5;
	const samples = new Float32Array(Math.ceil(RATE * dur));
	let lpState = 0;
	for (let i = 0; i < samples.length; i++) {
		const t = i / RATE;
		const p = t / dur;
		const amp = Math.sin(p * Math.PI) * Math.exp(-t * 2);
		const freq = 260 + 100 * (1 - Math.exp(-p * 4));
		const tone = sine(freq * t) * 0.25 + sine(freq * 1.5 * t) * 0.08;
		const noise = softNoise();
		lpState += 0.02 * (noise - lpState);
		samples[i] = (tone * amp + lpState * amp * 0.3) * 0.3;
	}
	writeWav('scale-pop', samples);
}

// 10. Ambient — warm evolving pad with slow LFO, like distant water
{
	const dur = 35;
	const samples = new Float32Array(Math.ceil(RATE * dur));
	const notes = [130.81, 196.0, 261.63, 329.63, 392.0];
	const fadeIn = 4;
	const fadeOut = 5;
	let lpState1 = 0;
	let lpState2 = 0;
	for (let i = 0; i < samples.length; i++) {
		const t = i / RATE;
		let vol = 1;
		if (t < fadeIn) vol = (t / fadeIn) * (t / fadeIn);
		if (t > dur - fadeOut) {
			const r = (dur - t) / fadeOut;
			vol = r * r;
		}
		const lfo1 = 1 + 0.2 * sine(0.12 * t);
		const lfo2 = 1 + 0.15 * sine(0.07 * t + 0.5);
		let s = 0;
		for (let n = 0; n < notes.length; n++) {
			const detune = 1 + 0.001 * sine(0.05 * t + n * 1.3);
			s += sine(notes[n] * detune * t) * (0.14 - n * 0.015) * lfo1;
		}
		const noise = softNoise();
		lpState1 += 0.003 * (noise - lpState1);
		lpState2 += 0.001 * (lpState1 - lpState2);
		s += lpState2 * 0.15 * lfo2;
		samples[i] = s * vol * 0.06;
	}
	writeWav('ambient', samples);
}

console.log('\nDone! All sound effects generated in public/sfx/');
