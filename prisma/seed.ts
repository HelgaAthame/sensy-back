import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@sensy.by';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Пользователь ${email} уже существует, пропускаю`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, passwordHash } });
  console.log(`Создан пользователь ${email} / ${password} — смените пароль после первого входа`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
