import darwinArm64 from 'bun-pty/rust-pty/target/release/librust_pty_arm64.dylib' with {
	type: 'file',
};
import darwinX64 from 'bun-pty/rust-pty/target/release/librust_pty.dylib' with {
	type: 'file',
};
import linuxArm64 from 'bun-pty/rust-pty/target/release/librust_pty_arm64.so' with {
	type: 'file',
};
import linuxX64 from 'bun-pty/rust-pty/target/release/librust_pty.so' with {
	type: 'file',
};
import windowsDll from 'bun-pty/rust-pty/target/release/rust_pty.dll' with {
	type: 'file',
};

export const RUST_PTY_LIBS = {
	darwin: {
		arm64: darwinArm64,
		x64: darwinX64,
	},
	linux: {
		arm64: linuxArm64,
		x64: linuxX64,
	},
	win32: {
		arm64: windowsDll,
		x64: windowsDll,
	},
} as const;
