export const apiClient = new Proxy(
	{},
	{
		get() {
			return async () => {
				throw new Error('API client is unavailable in share preview');
			};
		},
	},
);
