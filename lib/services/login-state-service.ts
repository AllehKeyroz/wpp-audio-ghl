
// This service manages the state of an interactive login process.
// It's a simple in-memory store, meaning the state will be reset if the server restarts.

export type LoginFlowState = 'Idle' | 'InProgress' | 'AwaitingOTP' | 'SubmittingOTP' | 'Complete' | 'Failed';

interface State {
  flowState: LoginFlowState;
  otp: string | null;
  errorMessage: string | null;
  otpPromise: {
    resolve: (otp: string) => void;
    reject: (reason?: any) => void;
  } | null;
}

// Initialize the state in memory.
const state: State = {
  flowState: 'Idle',
  otp: null,
  errorMessage: null,
  otpPromise: null,
};

export const getLoginState = () => {
  return { flowState: state.flowState, errorMessage: state.errorMessage };
};

export const setLoginState = (newState: LoginFlowState, errorMessage: string | null = null) => {
  state.flowState = newState;
  state.errorMessage = errorMessage;
  // When we move to a new state, clear any old OTP promise
  if (newState !== 'AwaitingOTP') {
    if (state.otpPromise) {
      state.otpPromise.reject('Login state changed.');
      state.otpPromise = null;
    }
    state.otp = null;
  }
};

export const submitOtp = (otp: string) => {
  if (state.flowState === 'AwaitingOTP' && state.otpPromise) {
    state.otpPromise.resolve(otp);
    state.otpPromise = null;
    state.flowState = 'SubmittingOTP';
    return true;
  }
  return false;
};

export const retrieveOtp = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (state.flowState === 'AwaitingOTP') {
      state.otpPromise = { resolve, reject };
    } else {
      reject('Not in a state to retrieve OTP.');
    }
    // Set a timeout to prevent waiting indefinitely
    setTimeout(() => {
        if (state.otpPromise) {
            state.otpPromise.reject('OTP retrieval timed out.');
            state.otpPromise = null;
            setLoginState('Failed', 'OTP retrieval timed out.');
        }
    }, 180000); // 3 minutes timeout
  });
};


// Function to reset the state, useful for starting over.
export const resetLoginFlow = () => {
    setLoginState('Idle');
}
