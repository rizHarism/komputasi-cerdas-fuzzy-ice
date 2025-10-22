fetch("https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=35.72.02.1002")
  .then((res) => res.json())
  .then((json) => {
    const allData = json.data[0].cuaca.flat(); // array cuaca

    // tanggal besok
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // yyyy-mm-dd

    // filter data 07:00 s/d 16:00
    const filtered = allData.filter((item) => {
      if (!item.local_datetime.startsWith(tomorrowStr)) return false;
      const time = item.local_datetime.split(" ")[1]; // ambil jam
      return time >= "07:00:00" && time <= "16:00:00";
    });

    if (filtered.length === 0) {
      console.log("Data tidak ditemukan");
      return;
    }

    console.log(filtered.map((a) => a.local_datetime.split(" ")[1] + ": " + a.t));
    // hitung rata-rata suhu
    const avgTemp = filtered.reduce((a, b) => a + b.t, 0) / filtered.length;

    // ambil data cuaca dominan
    const descCount = {};
    filtered.forEach((d) => {
      descCount[d.weather_desc] = (descCount[d.weather_desc] || 0) + 1;
    });
    const cuacaDominan = Object.entries(descCount).sort((a, b) => b[1] - a[1])[0][0];

    console.log(`📅 Tanggal: ${tomorrowStr}`);
    console.log(`🕖 Rentang waktu: 07:00–16:00`);
    console.log(`🌡️ Suhu rata-rata: ${avgTemp.toFixed(1)}°C`);
    console.log(`🌤️ Cuaca dominan: ${cuacaDominan}`);
  })
  .catch((err) => console.error("Error:", err));
