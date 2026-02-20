import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = new Set(process.argv.slice(2));
if (!args.has("--confirm")) {
  console.error("Refusing to run without --confirm");
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
});

const auth = getAuth();
const TEST_USERS = [
  {
    email: "amartyakarmakar@gmail.com",
    password: "password",
    role: "admin",
  },
  {
    email: "162478k@acadiau.ca",
    password: "password",
    role: "student",
  },
];

const allowlist = new Set(TEST_USERS.map((user) => user.email.toLowerCase()));

async function listAllUsers() {
  const users = [];
  let pageToken;

  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  return users;
}

async function upsertTestUsers() {
  for (const user of TEST_USERS) {
    let record;
    try {
      record = await auth.getUserByEmail(user.email);
      await auth.updateUser(record.uid, {
        password: user.password,
        emailVerified: true,
        disabled: false,
      });
      console.log(`updated user ${user.email}`);
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
      record = await auth.createUser({
        email: user.email,
        password: user.password,
        emailVerified: true,
      });
      console.log(`created user ${user.email}`);
    }

    await auth.setCustomUserClaims(record.uid, { role: user.role });
    console.log(`set role=${user.role} for ${user.email}`);
  }
}

async function deleteNonAllowlistedUsers() {
  const users = await listAllUsers();
  for (const user of users) {
    const email = (user.email ?? "").toLowerCase();
    if (!email || allowlist.has(email)) {
      continue;
    }

    await auth.deleteUser(user.uid);
    console.log(`deleted user ${user.email ?? user.uid}`);
  }
}

async function main() {
  console.log("Seeding test users and removing others...");
  await upsertTestUsers();
  await deleteNonAllowlistedUsers();
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
