import { sessionsMixin } from './sessions';
import { gitMixin } from './git';
import { configMixin } from './config';
import { filesMixin } from './files';
import { branchesMixin } from './branches';
import { approvalMixin } from './approval';
import { setuMixin } from './setu';
import { authMixin } from './auth';

export { configureApiClient } from './utils';

class ApiClient {
	getSessions = sessionsMixin.getSessions;
	getSessionsPage = sessionsMixin.getSessionsPage;
	createSession = sessionsMixin.createSession;
	updateSession = sessionsMixin.updateSession;
	deleteSession = sessionsMixin.deleteSession;
	abortSession = sessionsMixin.abortSession;
	abortMessage = sessionsMixin.abortMessage;
	getQueueState = sessionsMixin.getQueueState;
	removeFromQueue = sessionsMixin.removeFromQueue;
	getMessages = sessionsMixin.getMessages;
	sendMessage = sessionsMixin.sendMessage;
	getStreamUrl = sessionsMixin.getStreamUrl;
	retryMessage = sessionsMixin.retryMessage;

	initGitRepo = gitMixin.initGitRepo;
	getGitStatus = gitMixin.getGitStatus;
	getGitDiff = gitMixin.getGitDiff;
	getGitDiffFullFile = gitMixin.getGitDiffFullFile;
	generateCommitMessage = gitMixin.generateCommitMessage;
	stageFiles = gitMixin.stageFiles;
	unstageFiles = gitMixin.unstageFiles;
	restoreFiles = gitMixin.restoreFiles;
	deleteFiles = gitMixin.deleteFiles;
	commitChanges = gitMixin.commitChanges;
	getGitBranch = gitMixin.getGitBranch;
	pushCommits = gitMixin.pushCommits;
	pullChanges = gitMixin.pullChanges;
	getRemotes = gitMixin.getRemotes;
	addRemote = gitMixin.addRemote;
	removeRemote = gitMixin.removeRemote;

	getConfig = configMixin.getConfig;
	getModels = configMixin.getModels;
	getAllModels = configMixin.getAllModels;
	updateDefaults = configMixin.updateDefaults;

	listFiles = filesMixin.listFiles;
	getFileTree = filesMixin.getFileTree;
	readFileContent = filesMixin.readFileContent;
	getSessionFiles = filesMixin.getSessionFiles;

	createBranch = branchesMixin.createBranch;
	listBranches = branchesMixin.listBranches;
	getParentSession = branchesMixin.getParentSession;
	getShareStatus = branchesMixin.getShareStatus;
	shareSession = branchesMixin.shareSession;
	syncSession = branchesMixin.syncSession;

	approveToolCall = approvalMixin.approveToolCall;
	getPendingApprovals = approvalMixin.getPendingApprovals;

	getSetuBalance = setuMixin.getSetuBalance;
	getSetuWallet = setuMixin.getSetuWallet;
	getSetuUsdcBalance = setuMixin.getSetuUsdcBalance;
	getPolarTopupEstimate = setuMixin.getPolarTopupEstimate;
	createPolarCheckout = setuMixin.createPolarCheckout;
	selectTopupMethod = setuMixin.selectTopupMethod;
	cancelTopup = setuMixin.cancelTopup;
	getPendingTopup = setuMixin.getPendingTopup;
	getPolarTopupStatus = setuMixin.getPolarTopupStatus;

	getAuthStatus = authMixin.getAuthStatus;
	setupSetuWallet = authMixin.setupSetuWallet;
	importSetuWallet = authMixin.importSetuWallet;
	exportSetuWallet = authMixin.exportSetuWallet;
	addProvider = authMixin.addProvider;
	removeProvider = authMixin.removeProvider;
	completeOnboarding = authMixin.completeOnboarding;
	getOAuthStartUrl = authMixin.getOAuthStartUrl;
	getOAuthUrl = authMixin.getOAuthUrl;
	exchangeOAuthCode = authMixin.exchangeOAuthCode;
	startCopilotDeviceFlow = authMixin.startCopilotDeviceFlow;
	pollCopilotDeviceFlow = authMixin.pollCopilotDeviceFlow;
	getProviderUsage = authMixin.getProviderUsage;
}

export const apiClient = new ApiClient();
