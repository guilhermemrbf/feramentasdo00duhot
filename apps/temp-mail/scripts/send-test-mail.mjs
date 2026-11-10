import { mailFixture, sendMail } from "../tests/fixtures.mjs";

const address = process.argv[2];
if (!/^caixa-[a-f0-9]{24}@mail\.test$/u.test(address ?? "")) {
  throw new Error("Informe um endereço do ambiente local terminado em @mail.test.");
}
const throughMailpit = process.argv.includes("--mailpit");
const response = await sendMail(address, mailFixture(address, "Teste do Correio Temporário"), {
  host: "127.0.0.1", port: throughMailpit ? 1026 : 1025,
});
console.info("Resposta SMTP: " + response);
if (response !== 250) process.exitCode = 1;
