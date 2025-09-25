/** Holds the auth token so services can attach it to requests. Set by the auth store. */
let token: string | null = null;

export const session = {
  getToken: () => token,
  setToken: (value: string | null) => {
    token = value;
  },
};
