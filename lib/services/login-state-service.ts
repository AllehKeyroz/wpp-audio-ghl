// This service manages the state of interactive login processes for multiple users.
// It's a simple in-memory store, meaning the state will be reset if the server restarts.

export type LoginFlowState = 'Idle' | 'InProgress' | 'AwaitingOTP' | 'SubmittingOTP' | 'Complete' | 'Failed';

interface UserState {
  flowState: LoginFlowState;
  errorMessage: string | null;
  otpPromise: {
    resolve: (otp: string) => void;
    reject: (reason?: any) => void;
  } | null;
}

// In-memory store for user login states, keyed by email.
const userStates = new Map<string, UserState>();

const getInitialState = (): UserState => ({
    flowState: 'Idle',
    errorMessage: null,
    otpPromise: null,
});

export const getLoginState = (email: string) => {
  const userState = userStates.get(email) || getInitialState();
  return { flowState: userState.flowState, errorMessage: userState.errorMessage };
};

export const setLoginState = (email: string, newState: LoginFlowState, errorMessage: string | null = null) => {
  const userState = userStates.get(email) || getInitialState();
  
  userState.flowState = newState;
  userState.errorMessage = errorMessage;

  if (newState !== 'AwaitingOTP' && userState.otpPromise) {
      userState.otpPromise.reject('Login state changed.');
      userState.otpPromise = null;
  }
  
  userStates.set(email, userState);
};

export const submitOtp = (email: string, otp: string): boolean => {
  const userState = userStates.get(email);
  if (userState && userState.flowState === 'AwaitingOTP' && userState.otpPromise) {
    userState.otpPromise.resolve(otp);
    userState.otpPromise = null;
    userState.flowState = 'SubmittingOTP';
    userStates.set(email, userState);
    return true;
  }
  return false;
};

export const retrieveOtp = (email: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const userState = userStates.get(email) || getInitialState();
    if (userState.flowState === 'AwaitingOTP') {
      userState.otpPromise = { resolve, reject };
      userStates.set(email, userState);
    } else {
      reject('Not in a state to retrieve OTP.');
    }

    setTimeout(() => {
        const currentUserState = userStates.get(email);
        if (currentUserState?.otpPromise) {
            currentUserState.otpPromise.reject('OTP retrieval timed out.');
            setLoginState(email, 'Failed', 'OTP retrieval timed out.');
        }
    }, 180000); // 3 minutes timeout
  });
};

export const resetLoginFlow = (email: string) => {
    userStates.delete(email);
}
