$(document).ready(async function () {
  const url =
    "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=35.72.02.1002";

  const $tanggalInput = $("#tanggalInput");
  const $btnAmbil = $("#btnAmbil");
  const $loading = $("#loading");
  const $result = $("#result");
  const $prediksi = $("#prediksi");

  // === Inisialisasi fuzzy logic (load data penjualan)
  await FuzzyPrediksi.loadData();

  // Tampilkan tabel penjualan dari data fuzzy
  const rows = FuzzyPrediksi.data
    .map(
      (d) => `
      <tr>
        <td class="py-1 px-3">${d.tanggal}</td>
        <td class="py-1 px-3">${d.suhu}</td>
        <td class="py-1 px-3">${d.produksi.toLocaleString()} mL</td>
        <td class="py-1 px-3">Rp ${d.pendapatan.toLocaleString()}</td>
      </tr>
    `
    )
    .join("");

  $("#penjualanTable").html(rows);

  // --- set batas minimal & maksimal tanggal (hari ini sampai 2 hari ke depan)
  function normalizeDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  const today = new Date();
  const maxDay = new Date();
  maxDay.setDate(today.getDate() + 2);

  const toDateStr = (d) => d.toISOString().split("T")[0];
  $tanggalInput.attr("min", toDateStr(today));
  $tanggalInput.attr("max", toDateStr(maxDay));
  $tanggalInput.val(toDateStr(today));

  // --- event klik tombol
  $btnAmbil.on("click", function () {
    const selectedDate = $tanggalInput.val();

    if (!selectedDate) {
      alert("Silakan pilih tanggal terlebih dahulu.");
      return;
    }

    const selDateObj = new Date(selectedDate);
    if (selDateObj < normalizeDate(today) || selDateObj > maxDay) {
      alert("Tanggal harus antara hari ini dan 2 hari ke depan.");
      return;
    }

    // tampilkan loading
    $loading.removeClass("hidden").text("Memuat data dari BMKG...");
    $result.addClass("hidden");
    $prediksi.addClass("hidden");

    // ambil data dari BMKG
    $.getJSON(url)
      .done(function (json) {
        const allData = json.data[0].cuaca.flat();

        const filtered = allData.filter((item) => {
          if (!item.local_datetime.startsWith(selectedDate)) return false;
          const time = item.local_datetime.split(" ")[1];
          return time >= "07:00:00" && time <= "16:00:00";
        });

        if (filtered.length === 0) {
          $loading.text("Data tidak ditemukan untuk tanggal tersebut.");
          return;
        }

        $loading.addClass("hidden");
        $result.removeClass("hidden");

        // hitung suhu rata-rata
        const avgTemp = filtered.reduce((a, b) => a + b.t, 0) / filtered.length;

        // cari cuaca dominan
        const descCount = {};
        filtered.forEach((d) => {
          descCount[d.weather_desc] = (descCount[d.weather_desc] || 0) + 1;
        });
        const cuacaDominan = Object.entries(descCount).sort(
          (a, b) => b[1] - a[1]
        )[0][0];

        // tampilkan hasil cuaca
        $("#tanggal").text(selectedDate);
        $("#suhu").text(avgTemp.toFixed(1));
        $("#cuaca").text(cuacaDominan);

        const listItems = filtered
          .map(
            (a) =>
              `<li>🕓 ${a.local_datetime.split(" ")[1]} → ${a.t}°C (${
                a.weather_desc
              })</li>`
          )
          .join("");
        $("#list").html(listItems);

        // Jalankan logika fuzzy berdasarkan suhu rata-rata
        const hasil = FuzzyPrediksi.infer(avgTemp);

        $("#liter").html(`${hasil.produksiLiter.toFixed(1)} `);
        $("#pendapatan").html(`Rp. ${hasil.pendapatan.toLocaleString()}`);
        $prediksi.removeClass("hidden");

        console.log(hasil.debug);
      })
      .fail(function (err) {
        $loading.text("Gagal mengambil data BMKG!");
        console.error(err);
      });
  });
});
