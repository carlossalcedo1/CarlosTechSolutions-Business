// Shared with the backend by convention, not by code: CODE_LENGTH here has
// to match login_codes.py's, and backend/app/schemas.py pins the API to the
// same number. It lives in its own module rather than inline in the page so
// there's one obvious place to change if the length ever moves, and so the
// input's maxLength, the placeholder and the submit guard can't drift apart
// from each other.
export const CODE_LENGTH = 6;
