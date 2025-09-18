const fs = require("fs");
const axios = require("axios");
const qs = require("querystring");
const cheerio = require("cheerio");

// --- beállítások / helper ---
const ENDPOINT =
  "https://mediaklikk.hu/wp-content/plugins/hms-global-widgets/widgets/programGuide/programGuideInterface.php";

const HEADERS = {
  Origin: "https://mediaklikk.hu",
  Referer: "https://mediaklikk.hu/musorujsag",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "User-Agent": "Mozilla/5.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "X-Requested-With": "XMLHttpRequest",
  "Accept-Language": "hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7",
  // Ha a szerver ragaszkodik hozzá, vedd ki a kommentet:
  // Cookie: "SERVERID=mtvecookieE",
};

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(isoDate, delta) {
  // isoDate: "YYYY-MM-DD"
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

const ensureTrailingComma = (s) => (s && !s.endsWith(",") ? s + "," : s || "");

// --- A felhasználó által kért paraméterek (pont így) ---
function buildForm(dateStr) {
  return {
    ChannelIds: ensureTrailingComma("3,1,2,30,33,4,34,"), // Duna, M1, M2, M4, M5, DW, M4+
    ShortCodes: ensureTrailingComma("dn,m1,m2,m4,m5,dw,m4p,"),
    Names: ensureTrailingComma("Duna,M1,M2,M4+Sport,M5,Duna+World,M4+Sport++,"),
    Date: dateStr,
    Type: "0",
    buttonType: "text_type",
    newDesign: "true",
    debug: "0",
  };
}

// --- dátum parszoló: "2025-09-18 00:34:12+0200"
function parseDT(s) {
  if (!s) return null;
  // "2025-09-18 00:34:12+0200" → "2025-09-18T00:34:12+02:00"
  const fixed = s.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const dt = new Date(fixed);
  return isNaN(dt.getTime()) ? null : dt;
}

// --- lekérés + parse ---
async function fetchHtml(date) {
  const form = buildForm(date);
  const { data } = await axios.post(ENDPOINT, qs.stringify(form), {
    headers: HEADERS,
    timeout: 15000,
  });
  return String(data);
}

function parseHtml(html) {
  const $ = cheerio.load(html);
  const items = [];

  $(".tvguide.channel").each((_, channelBlock) => {
    const $ch = $(channelBlock);
    const channelName =
      $ch.find(".channel_header .channel_info .channel_name").text().trim() ||
      "ismeretlen";

    $ch.find("li.program_body.available").each((_, li) => {
      const $li = $(li);

      const from = $li.attr("data-from") || "";
      const till = $li.attr("data-till") || "";

      let durationMinutes = 0;
      if (from && till) {
        const start = parseDT(from);
        const end = parseDT(till);
        if (start && end) {
          durationMinutes = Math.round((end - start) / 60000);
          if (durationMinutes < 0) {
            // ha véletlen negatív (másnapra nyúlik)
            durationMinutes += 24 * 60;
          }
        }
      }

      // csak 60 percnél hosszabb műsorok
      if (durationMinutes > 60) {
        items.push({
          from,
          till,
          durationMinutes,
          title: $li.find(".program_info h1").text().trim(),
          subtitle: $li.find(".program_info p").first().text().trim(),
          age: $li.find(".adultContentLimit div").text().trim(),
          time: $li.find(".time time").text().trim(),
          channel: channelName,
          vpslug: $li.attr("data-vpslug") || "",
          videolink: $li.attr("data-videolink") || "",
        });
      }
    });
  });

  return items;
}

// --- 60 napos futtatás, napokra csoportosítva ---
(async () => {
  const startDate = process.argv[2] || today(); // ettől a naptól megyünk vissza
  const DAYS = 60;

  const days = []; // { date, count, items: [...] } — a napok csökkenő sorrendben (ma felül)

  try {
    for (let i = 0; i < DAYS; i++) {
      const date = addDays(startDate, -i); // ma, tegnap, tegnapelőtt, ...
      try {
        const html = await fetchHtml(date);
        const items = parseHtml(html);

        // napon belül időrend (kezdéstől növekvő)
        items.sort((a, b) => {
          const da = parseDT(a.from);
          const db = parseDT(b.from);
          return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
        });

        days.push({ date, count: items.length, items });
        console.log(`[OK] ${date} → ${items.length} tétel`);
      } catch (e) {
        console.warn(`[WARN] ${date} lekérés/parszolás hiba:`, e.response?.status ?? "", e.message);
        days.push({ date, count: 0, items: [] });
      }
    }

    // a "days" már ma → ma-59 nap sorrendben van, tehát ma felül marad
    const out = {
      from: addDays(startDate, -(DAYS - 1)),
      to: startDate,
      daysCount: DAYS,
      days, // ma felül; napon belül időrendben
    };

    fs.writeFileSync(
      `programs-last-${DAYS}d.json`,
      JSON.stringify(out, null, 2),
      "utf8"
    );

    console.log(`Kész: programs-last-${DAYS}d.json`);
  } catch (err) {
    console.error("Végzetes hiba:", err.response?.status ?? "", err.message);
    if (err.response?.data) {
      console.error(String(err.response.data).slice(0, 400));
    }
    process.exit(1);
  }
})();
