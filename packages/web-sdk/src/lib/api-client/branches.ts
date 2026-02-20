import {
	createBranch as apiCreateBranch,
	listBranches as apiListBranches,
	getParentSession as apiGetParentSession,
	getShareStatus as apiGetShareStatus,
	shareSession as apiShareSession,
	syncShare as apiSyncShare,
} from '@ottocode/api';
import type {
	CreateBranchRequest,
	BranchResult,
	ListBranchesResponse,
	ParentSessionResponse,
	ShareStatus,
	ShareSessionResponse,
	SyncSessionResponse,
} from '../../types/api';
import { extractErrorMessage } from './utils';

export const branchesMixin = {
	async createBranch(
		sessionId: string,
		data: CreateBranchRequest,
	): Promise<BranchResult> {
		const response = await apiCreateBranch({
			path: { sessionId },
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch
			body: data as any,
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		return response.data as unknown as BranchResult;
	},

	async listBranches(sessionId: string): Promise<ListBranchesResponse> {
		const response = await apiListBranches({ path: { sessionId } });
		if (response.error) throw new Error(extractErrorMessage(response.error));
		return response.data as unknown as ListBranchesResponse;
	},

	async getParentSession(sessionId: string): Promise<ParentSessionResponse> {
		const response = await apiGetParentSession({ path: { sessionId } });
		if (response.error) throw new Error(extractErrorMessage(response.error));
		return response.data as ParentSessionResponse;
	},

	async getShareStatus(sessionId: string): Promise<ShareStatus> {
		const response = await apiGetShareStatus({ path: { sessionId } });
		if (response.error) return { shared: false };
		return response.data as ShareStatus;
	},

	async shareSession(sessionId: string): Promise<ShareSessionResponse> {
		const response = await apiShareSession({ path: { sessionId } });
		if (response.error) throw new Error(extractErrorMessage(response.error));
		return response.data as ShareSessionResponse;
	},

	async syncSession(sessionId: string): Promise<SyncSessionResponse> {
		const response = await apiSyncShare({ path: { sessionId } });
		if (response.error) throw new Error(extractErrorMessage(response.error));
		return response.data as SyncSessionResponse;
	},
};
