
// This service manages the state of an interactive login process.
// It's a simple in-memory store, meaning the state will be reset if the server restarts.

export type LoginFlowState = 'Idle' | 'InProgress' | 'AwaitingOTP' | 'SubmittingOTP' | 'Complete' | 'Failed';

interface State {
  flowState: LoginFlowState;
  otp: string | null;
  errorMessage: string | null;
}

// Initialize the state in memory.
const state: State = {
  flowState: 'Idle',
  otp: null,
  errorMessage: null,
};

export const getLoginState = () => {
  return { flowState: state.flowState, errorMessage: state.errorMessage };
};

export const setLoginState = (newState: LoginFlowState, errorMessage: string | null = null) => {
  state.flowState = newState;
  state.errorMessage = errorMessage;
  // When we move to a new state, clear any old OTP
  if (newState !== 'AwaitingOTP') {
    state.otp = null;
  }
};

export const submitOtp = (otp: string) => {
  if (state.flowState === 'AwaitingOTP') {
    state.otp = otp;
    state.flowState = 'SubmittingOTP';
    return true;
  }
  return false;
};

export const retrieveOtp = (): string | null => {
    if (state.flowState === 'SubmittingOTP') {
        return state.otp;
    }
    return null;
};

// Function to reset the state, useful for starting over.
export const resetLoginFlow = () => {
    setLoginState('Idle');
}
