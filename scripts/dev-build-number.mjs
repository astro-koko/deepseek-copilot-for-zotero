const now = new Date();
const year = String(now.getFullYear()).slice(-2);
const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
const dayOfYear = Math.floor((now - startOfYear) / 86_400_000);
const hour = String(now.getUTCHours()).padStart(2, "0");
const minute = String(now.getUTCMinutes()).padStart(2, "0");

process.stdout.write(`${year}${String(dayOfYear).padStart(3, "0")}${hour}${minute}`);
