import { push } from 'react-router-redux';

import {
  savedSectorSelector,
  userFormSelector,
  userUidSelector,
  userModelLocaleSelector,
} from 'store/selectors/base.selectors';
import { getSavedEntities } from 'store/selectors/entity.selectors';
import { pick } from 'constants/lodash';

import {
  updateCurrentUser,
  getUserData,
  doFacebookLogin,
  doGoogleLogin,
  doSignup,
  doLogin,
  doPasswordReset,
  doLogout,
} from 'store/api/user';
import { getSyncedSectors, uploadEntities } from 'store/api/entity';

import Locale from 'constants/locale';
import { SuccessToast, ErrorToast } from 'utils/toasts';

const ACTION_PREFIX = '@@user';
export const OPENED_LOGIN_MODAL = `${ACTION_PREFIX}/OPENED_LOGIN_MODAL`;
export const CLOSED_LOGIN_MODAL = `${ACTION_PREFIX}/CLOSED_LOGIN_MODAL`;
export const OPENED_EDIT_MODAL = `${ACTION_PREFIX}/OPENED_EDIT_MODAL`;
export const CLOSED_EDIT_MODAL = `${ACTION_PREFIX}/CLOSED_EDIT_MODAL`;
export const CLOSED_SYNC_MODAL = `${ACTION_PREFIX}/CLOSED_SYNC_MODAL`;
export const UPDATED_USER_FORM = `${ACTION_PREFIX}/UPDATED_USER_FORM`;
export const UPDATED_USER = `${ACTION_PREFIX}/UPDATED_USER`;
export const LOGGED_IN = `${ACTION_PREFIX}/LOGGED_IN`;
export const LOGGED_OUT = `${ACTION_PREFIX}/LOGGED_OUT`;
export const AUTH_FAILURE = `${ACTION_PREFIX}/AUTH_FAILURE`;

export const openEditModal = () => ({ type: OPENED_EDIT_MODAL });
export const closeEditModal = () => ({ type: CLOSED_EDIT_MODAL });
export const openLoginModal = () => ({ type: OPENED_LOGIN_MODAL });
export const closeLoginModal = () => ({ type: CLOSED_LOGIN_MODAL });
export const closeSyncModal = () => ({ type: CLOSED_SYNC_MODAL });
export const updateUserForm = (key, value) => ({
  type: UPDATED_USER_FORM,
  key,
  value,
});

const onLogin = (dispatch, state) => result => {
  const localSync = !!savedSectorSelector(state).length;
  const uid = result.user ? result.user.uid : result.uid;
  let promise = Promise.resolve();
  if (localSync) {
    promise = uploadEntities(getSavedEntities(state));
  }
  return promise
    .then(() => Promise.all([getSyncedSectors(uid), getUserData(uid)]))
    .then(([sectors, userData]) => {
      dispatch(push('/'));
      dispatch({
        type: LOGGED_IN,
        user: {
          ...(result.user ? result.user.toJSON() : result.toJSON()),
          ...userData,
        },
        didSyncLocal: localSync,
        sectors,
      });
      return result;
    })
    .catch(error => {
      dispatch({ type: AUTH_FAILURE });
      console.error(error);
    });
};

export const facebookLogin = () => (dispatch, getState) =>
  doFacebookLogin()
    .then(onLogin(dispatch, getState()))
    .catch(error => {
      dispatch({ type: AUTH_FAILURE });
      console.error(error);
    });

export const googleLogin = () => (dispatch, getState) =>
  doGoogleLogin()
    .then(onLogin(dispatch, getState()))
    .catch(error => {
      dispatch({ type: AUTH_FAILURE });
      console.error(error);
    });

export const signup = intl => (dispatch, getState) => {
  const state = getState();
  const { email, password, confirm } = userFormSelector(state);
  if (!email || !password || !confirm) {
    return dispatch({
      type: AUTH_FAILURE,
      error: intl.formatMessage({ id: 'misc.emailPassword' }),
    });
  } else if (password !== confirm) {
    return dispatch({
      type: AUTH_FAILURE,
      error: intl.formatMessage({ id: 'misc.noPasswordMatch' }),
    });
  }
  return doSignup(email, password)
    .then(onLogin(dispatch, state))
    .then(result => result.sendEmailVerification())
    .catch(error => {
      dispatch({ type: AUTH_FAILURE });
      console.error(error);
    });
};

export const login = intl => (dispatch, getState) => {
  const state = getState();
  const { email, password } = userFormSelector(state);
  if (!email || !password) {
    return dispatch({
      type: AUTH_FAILURE,
      error: intl.formatMessage({ id: 'misc.emailPassword' }),
    });
  }
  return doLogin(email, password)
    .then(onLogin(dispatch, state))
    .catch(error => {
      dispatch({ type: AUTH_FAILURE });
      console.error(error);
    });
};

export const passwordReset = intl => (dispatch, getState) => {
  const state = getState();
  const { email } = userFormSelector(state);
  return doPasswordReset(email)
    .then(() => {
      dispatch(closeLoginModal());
      dispatch(
        SuccessToast({
          title: intl.formatMessage({ id: 'misc.passwordResetSent' }),
          message: intl.formatMessage({ id: 'misc.receiveEmail' }),
        }),
      );
    })
    .catch(error => {
      dispatch({ type: AUTH_FAILURE, error: error.message });
      console.error(error);
    });
};

export const updateUser = intl => (dispatch, getState) => {
  const state = getState();
  const uid = userUidSelector(state);
  let filteredForm = pick(userFormSelector(state), 'displayName', 'locale');
  if (!Locale[filteredForm.local || 'en']) {
    filteredForm = { ...filteredForm, locale: 'en' };
  }
  return updateCurrentUser(uid, { ...filteredForm })
    .then(() => {
      if (userModelLocaleSelector(state) !== (filteredForm.locale || 'en')) {
        window.location.reload();
      } else {
        dispatch({
          type: UPDATED_USER,
          user: filteredForm,
        });
      }
    })
    .catch(err => {
      dispatch(
        ErrorToast({
          title: intl.formatMessage({ id: 'misc.error' }),
          message: intl.formatMessage({ id: 'misc.reportProblemPersists' }),
        }),
      );
      console.error(err);
    });
};

export const logout = intl => dispatch =>
  doLogout()
    .then(() => {
      dispatch(push('/'));
      dispatch({ type: LOGGED_OUT });
    })
    .catch(err => {
      dispatch(
        ErrorToast({
          title: intl.formatMessage({ id: 'misc.error' }),
          message: intl.formatMessage({ id: 'misc.reportProblemPersists' }),
        }),
      );
      console.error(err);
    });
