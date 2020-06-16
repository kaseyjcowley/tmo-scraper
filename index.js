require("dotenv").config();

const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");

const sendMail = (screenshot) => {
  const nodeMailerMailGun = nodemailer.createTransport(
    mg({
      auth: {
        api_key: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_API_DOMAIN,
      },
    })
  );

  nodeMailerMailGun.sendMail(
    {
      from: "tmoscraper@example.com",
      to: process.env.MAIL_TO,
      subject: "OnePlus 7 Pro Stock Alert",
      text:
        "Looks like the OnePlus 7 Pro just came back in stock at T-Mobile! Better go check it out: https://www.t-mobile.com/cell-phone/oneplus-7-pro",
      attachments: [{filename: "screenshot.png", content: screenshot}],
    },
    (err, info) => {
      if (err) {
        console.log(`Error: ${err}`);
      } else {
        console.log(`Response: ${info}`);
      }
    }
  );
};

(async () => {
  const browser = await puppeteer.launch({
    headless: process.env.NODE_ENV === "production",
    devtools: process.env.NODE_ENV === "development",
    defaultViewport: {
      width: 1280,
      height: 960,
    },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36"
  );
  await page.goto("https://www.t-mobile.com/cell-phone/oneplus-7-pro", {
    timeout: 0,
  });

  const isInStock = await page.evaluate(() => {
    const stockText = document.querySelector("tmo-online-stock").textContent;
    return !/out of stock/i.test(stockText);
  });

  const screenshot = await page.screenshot();

  if (isInStock || Boolean(Number(process.env.DRY_RUN))) {
    sendMail(screenshot);
  }

  await browser.close();
})();
