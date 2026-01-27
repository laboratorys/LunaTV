import { compare, genSalt, hash } from 'bcryptjs';

/**
 * 加密密码
 * @param password 明文密码
 */
export async function hashPassword(password: string) {
  const salt = await genSalt(10);
  return await hash(password, salt);
}

/**
 * 校验密码
 * @param password 明文密码
 * @param hashedPassword 数据库中的加密哈希
 */
export async function verifyPassword(password: string, hashedPassword: string) {
  //兼容旧数据
  if (password === hashedPassword) return true;
  const isValid = await compare(password, hashedPassword);
  return isValid;
}

/**
 * 判断字符串是否为 Bcrypt 哈希
 * @param str 密码字符转
 * @returns
 */
export function isBcryptHash(str: string): boolean {
  // Bcrypt 哈希通常以 $2a$, $2b$ 或 $2y$ 开头，长度为 60
  const bcryptRegex = /^\$2[ayb]\$.{56}$/;
  return bcryptRegex.test(str);
}
