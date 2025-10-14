export interface GitFile {
	path: string;
	absPath: string;
	status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
	staged: boolean;
	insertions?: number;
	deletions?: number;
	oldPath?: string;
	isNew: boolean;
}

export interface GitRoot {
	gitRoot: string;
}

export interface GitError {
	error: string;
	code?: string;
}
