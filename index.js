require("dotenv").config();

const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");

const sendMail = (candidates) => {
  const nodeMailerMailGun = nodemailer.createTransport(
    mg({
      auth: {
        api_key: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_API_DOMAIN,
      },
    })
  );

  const [fulls, partials] = candidates;

  nodeMailerMailGun.sendMail(
    {
      from: "swappa-scraper@example.com",
      to: process.env.MAIL_TO,
      subject: "iPhone XS Max Stock Alert",
      html: `Here's a list of iPhone XS Max phones that have battery percentages listed:
<br /><br />      
<strong>100% Battery Health:</strong><br />
${
  fulls.length
    ? fulls.map(([, price, link]) => `${price} - ${link}`).join("<br />")
    : "None"
}
<br /><br />
<strong>Others:</strong><br />
${partials
  .map(([percentage, price, link]) => `${percentage}% - ${price} - ${link}`)
  .join("<br />")}
      `,
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
  const response = await page.goto(
    "https://www.t-mobile.com/cell-phone/oneplus-7-pro",
    {
      timeout: 0,
    }
  );

  await page.goto(
    "https://swappa.com/mobile/buy/apple-iphone-xs-max/unlocked?sort=price_min&color=space-gray&color=silver&storage=64gb&condition=mint",
    {
      timeout: 0,
    }
  );

  const candidates = await page.$$eval(".listing_row", (rows) =>
    rows
      .map((row) => {
        const normalizedRow = row.textContent.replace(/\s{2,}/g, " ");
        const listingRowBatteryMatch = normalizedRow.match(
          /(\d{2,3})%\s(?:battery|🔋)/
        );

        if (listingRowBatteryMatch) {
          const price = row.querySelector(".price").textContent;
          const link = row.firstElementChild.href;
          return [listingRowBatteryMatch[1], price, link];
        }
      })
      .filter(Boolean)
      .reduce(
        ([fulls, partials], match) => {
          if (Number(match[0]) === 100) {
            return [fulls.concat([match]), partials];
          } else {
            return [
              fulls,
              partials
                .concat([match])
                .sort(
                  ([aPercent], [bPercent]) =>
                    Number(bPercent) - Number(aPercent)
                ),
            ];
          }
        },
        [[], []]
      )
  );

  if (candidates.length || Boolean(Number(process.env.DRY_RUN))) {
    sendMail(candidates);
  }

  await browser.close();
})();
