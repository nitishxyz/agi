export interface GitFile {
	path: string;
	absPath: string;
	status:
		| 'modified'
		| 'added'
		| 'deleted'
		| 'renamed'
		| 'untracked'
		| 'conflicted';
	staged: boolean;
	insertions?: number;
	deletions?: number;
	oldPath?: string;
	isNew: boolean;
	conflictType?:
		| 'both-modified'
		| 'deleted-by-us'
		| 'deleted-by-them'
		| 'both-added'
		| 'both-deleted';
}

export interface GitRoot {
	gitRoot: string;
}

export interface GitError {
	error: string;
	code?: string;
}
