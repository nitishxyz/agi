use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
};

fn main() {
    println!("cargo:rustc-check-cfg=cfg(otto_canvas_libghostty_vt)");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-env-changed=OTTO_CANVAS_GHOSTTY_SOURCE_DIR");
    println!("cargo:rerun-if-env-changed=OTTO_CANVAS_LIBGHOSTTY_VT_SOURCE_DIR");
    println!("cargo:rerun-if-env-changed=OTTO_CANVAS_LIBGHOSTTY_VT_LIB_DIR");
    println!("cargo:rerun-if-env-changed=OTTO_CANVAS_LIBGHOSTTY_VT_OPTIMIZE");

    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("linux") {
        println!("cargo:rustc-link-lib=util");
    }

    if let Some(lib_dir) = resolve_libghostty_vt_dir() {
        let lib_dir = lib_dir.canonicalize().unwrap_or_else(|_| lib_dir.clone());
        println!("cargo:rustc-link-search=native={}", lib_dir.display());
        println!("cargo:rustc-link-lib=dylib=ghostty-vt");
        println!("cargo:rustc-link-arg=-Wl,-rpath,{}", lib_dir.display());
        if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
            println!(
                "cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../Resources/resources/ghostty/lib"
            );
            println!(
                "cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../Resources/ghostty/lib"
            );
        }
        println!("cargo:rustc-cfg=otto_canvas_libghostty_vt");
        println!(
            "cargo:rustc-env=OTTO_CANVAS_LIBGHOSTTY_VT_LIB_DIR={}",
            lib_dir.display()
        );
    }

    tauri_build::build();
}

fn resolve_libghostty_vt_dir() -> Option<PathBuf> {
    if let Ok(lib_dir) = env::var("OTTO_CANVAS_LIBGHOSTTY_VT_LIB_DIR") {
        let lib_dir = PathBuf::from(lib_dir);
        ensure_dynamic_lib_exists(&lib_dir);
        return Some(lib_dir);
    }

    let manifest_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR").expect("Cargo always sets CARGO_MANIFEST_DIR"),
    );

    let staged_lib_dir = manifest_dir.join("resources").join("ghostty").join("lib");
    if staged_lib_dir.exists() {
        ensure_dynamic_lib_exists(&staged_lib_dir);
        return Some(staged_lib_dir);
    }

    if let Ok(source_dir) = env::var("OTTO_CANVAS_LIBGHOSTTY_VT_SOURCE_DIR") {
        let source_dir = PathBuf::from(source_dir);
        build_libghostty_vt(&source_dir);
        let lib_dir = source_dir.join("zig-out").join("lib");
        ensure_dynamic_lib_exists(&lib_dir);
        println!(
            "cargo:rustc-env=OTTO_CANVAS_LIBGHOSTTY_VT_SOURCE_DIR={}",
            source_dir.display()
        );
        return Some(lib_dir);
    }

    if let Ok(source_dir) = env::var("OTTO_CANVAS_GHOSTTY_SOURCE_DIR") {
        let source_dir = PathBuf::from(source_dir);
        build_libghostty_vt(&source_dir);
        let lib_dir = source_dir.join("zig-out").join("lib");
        ensure_dynamic_lib_exists(&lib_dir);
        return Some(lib_dir);
    }

    for source_dir in [
        manifest_dir.join("..")
            .join("..")
            .join("..")
            .join("vendor")
            .join("ghostty"),
        manifest_dir.join("..")
            .join("..")
            .join("..")
            .join("tmp")
            .join("ghostty"),
    ] {
        if !source_dir.join("build.zig").exists() {
            continue;
        }

        build_libghostty_vt(&source_dir);
        let lib_dir = source_dir.join("zig-out").join("lib");
        ensure_dynamic_lib_exists(&lib_dir);
        return Some(lib_dir);
    }

    None
}

fn build_libghostty_vt(source_dir: &Path) {
    if !source_dir.exists() {
        panic!(
            "OTTO_CANVAS_LIBGHOSTTY_VT_SOURCE_DIR does not exist: {}",
            source_dir.display()
        );
    }

    let optimize = env::var("OTTO_CANVAS_LIBGHOSTTY_VT_OPTIMIZE")
        .unwrap_or_else(|_| "ReleaseFast".to_string());

    let status = Command::new("zig")
        .arg("build")
        .arg("-Demit-lib-vt")
        .arg(format!("-Doptimize={optimize}"))
        .current_dir(source_dir)
        .status()
        .unwrap_or_else(|error| {
            panic!(
                "failed to run `zig build` for libghostty-vt in {}: {error}",
                source_dir.display()
            )
        });

    if !status.success() {
        panic!(
            "`zig build -Demit-lib-vt` failed in {} with status {status}",
            source_dir.display()
        );
    }
}

fn ensure_dynamic_lib_exists(lib_dir: &Path) {
    let dylib_name = match env::var("CARGO_CFG_TARGET_OS").as_deref() {
        Ok("macos") => "libghostty-vt.dylib",
        Ok("linux") => "libghostty-vt.so",
        Ok("windows") => "ghostty-vt.dll",
        _ => "libghostty-vt.dylib",
    };
    let dylib = lib_dir.join(dylib_name);
    if !dylib.exists() {
        panic!(
            "libghostty-vt dynamic library was not found at {}. Build ghostty with `zig build -Demit-lib-vt` or set OTTO_CANVAS_LIBGHOSTTY_VT_LIB_DIR to a directory containing {}.",
            dylib.display(),
            dylib_name
        );
    }
}
