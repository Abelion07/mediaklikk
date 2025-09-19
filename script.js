const content = document.querySelector(".content");

fetch("programs.json")
  .then((r) => r.json())
  .then((data) => {
    // console.log(data);
    adatkiiras(data);
  });

function adatkiiras(programs) {
  content.innerHTML = `<h2>Műsorok: ${programs.from} és ${programs.to} között</h2>`;
  programs.days.forEach((date) => {
    // console.log(date);
    const aktdatum = document.createElement("div");
    aktdatum.classList.add("aktdatum");
    aktdatum.innerHTML = `<h3 class="aktfilm">${date.date}</h3>`;
    content.appendChild(aktdatum);
    date.items.forEach((item) => {
      // console.log(`${date.date} - ${item.title}`)
      const aktfilm = document.createElement("div");
      aktfilm.classList.add("aktfilm");
      aktfilm.innerHTML = `
            <h4>${item.title}</h4>
            <p>${item.subtitle}</p>
            <p>${item.durationMinutes} perc</p>
            <div>
            <a href="${item.videolink}" target="_blank">
            <button>Megtekintés</button>
            </a>
            <button class="others">&#9776;</button>
            </div>
        `;
      aktfilm.querySelector(".others").onclick = () => others(item);
      aktdatum.appendChild(aktfilm);
    });
  });
}

// {
//     "from": "2025-07-23 00:30:18+0200",
//     "till": "2025-07-23 01:37:30+0200",
//     "durationMinutes": 67,
//     "title": "Jazz Akusztik",
//     "subtitle": "Szirtes Edina Quintet ft. Jammel",
//     "age": "12",
//     "time": "00:30",
//     "channel": "ismeretlen",
//     "vpslug": "jazz-akusztik-szirtes-edina-quintet-ft-jammel",
//     "videolink": "https://mediaklikk.hu/video/jazz-akusztik-szirtes-edina-quintet-ft-jammel/"
// }

function others(item) {
  // Create modal container
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  modal.style.zIndex = "1000";

  // Create modal content
  const modalContent = document.createElement("div");
  modalContent.style.backgroundColor = "#fff";
  modalContent.style.padding = "20px";
  modalContent.style.borderRadius = "10px";
  modalContent.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
  modalContent.style.width = "600px";
  modalContent.style.textAlign = "center";

  modalContent.innerHTML = `
    <h4>${item.title}</h4>
    <p>${item.subtitle}</p>
    <p>Időtartam: ${item.durationMinutes} perc</p>
    <p>Kezdés: ${item.time}</p>
    <p>Korhatár: ${item.age}</p>
    <p>Csatorna: ${item.channel}</p>
    <p>${item.from}</p>
    <p>${item.till}</p>
    <a href="${item.videolink}" target="_blank">Videó megtekintése</a>
    <br><br>
    <button id="closeModal" style="padding: 10px 20px; background: #007BFF; color: #fff; border: none; border-radius: 5px; cursor: pointer;">Bezárás</button>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close modal functionality
  document.getElementById("closeModal").onclick = function () {
    document.body.removeChild(modal);
  };
}
