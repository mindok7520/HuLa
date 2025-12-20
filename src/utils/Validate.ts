/** 문자열에 특수 문자가 포함되어 있는지 확인 */
export const validateSpecialChar = (value: string, patten = /[!@#¥$%.&*^()_+=\-~]/) => patten.test(value)

/** 문자에 영문자와 숫자가 포함되어 있는지 확인 */
export const validateAlphaNumeric = (value: string) => {
  const hasLetter = /[a-zA-Z]/.test(value)
  const hasNumber = /[0-9]/.test(value)
  return hasLetter && hasNumber
}
