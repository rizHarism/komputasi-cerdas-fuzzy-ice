/**
 * fuzzy.js (versi dinamis)
 * Membaca data dari /data/penjualan.json
 * Membangun fungsi keanggotaan suhu & produksi otomatis dari data
 * Menggunakan metode Mamdani dan defuzzifikasi centroid
 */

(function (global) {
  // Helper fungsi segitiga
  function tri(x, a, b, c) {
    if (x <= a || x >= c) return 0;
    if (x === b) return 1;
    if (x > a && x < b) return (x - a) / (b - a);
    return (c - x) / (c - b);
  }

  // Variabel global internal
  let MF_Suhu = null;
  let MF_Produksi = null;
  let OUTPUT_MIN = 0;
  let OUTPUT_MAX = 0;
  let DATA_PENJUALAN = [];

  /**
   * 🔹 loadData()
   * Membaca file penjualan.json dan menentukan rentang suhu & produksi
   */
  async function loadData() {
    const res = await fetch("./data/penjualan.json");
    const data = await res.json();
    DATA_PENJUALAN = data;

    // Ambil array suhu dan produksi
    const suhuArr = data.map((d) => d.suhu);
    const prodArr = data.map((d) => d.produksi);

    const suhuMin = Math.min(...suhuArr);
    const suhuMax = Math.max(...suhuArr);
    const prodMin = Math.min(...prodArr);
    const prodMax = Math.max(...prodArr);

    OUTPUT_MIN = prodMin;
    OUTPUT_MAX = prodMax;

    // Hitung titik-titik pembagi secara dinamis
    const suhuMean = mean(suhuArr);
    const prodMean = mean(prodArr);

    // Range fuzzy untuk suhu (otomatis)
    MF_Suhu = {
      dingin: (x) => tri(x, suhuMin - 1, suhuMin, suhuMean),
      normal: (x) => tri(x, suhuMin + 1, suhuMean, suhuMax - 1),
      panas: (x) => tri(x, suhuMean, suhuMax, suhuMax + 1),
    };

    // Range fuzzy untuk produksi (otomatis)
    MF_Produksi = {
      rendah: (y) => tri(y, prodMin - 500, prodMin, prodMean),
      sedang: (y) => tri(y, prodMin + 1000, prodMean, prodMax - 1000),
      tinggi: (y) => tri(y, prodMean, prodMax, prodMax + 500),
    };

    console.log("[FUZZY] Data dimuat:", { suhuMin, suhuMax, prodMin, prodMax });
    console.log("[FUZZY] MF Suhu & Produksi siap.");
  }

  /**
   * 🔹 infer()
   * Proses fuzzy inference berdasarkan suhu input
   */
  function infer(suhu) {
    if (!MF_Suhu || !MF_Produksi) {
      console.warn("Fuzzy belum diinisialisasi. Panggil loadData() dulu.");
      return null;
    }

    // 1️⃣ Fuzzifikasi input suhu
    const mu = {
      suhu: {
        dingin: MF_Suhu.dingin(suhu),
        normal: MF_Suhu.normal(suhu),
        panas: MF_Suhu.panas(suhu),
      },
    };

    // 2️⃣ Aturan fuzzy (rule base)
    const rules = [
      { if: "dingin", then: "rendah" },
      { if: "normal", then: "sedang" },
      { if: "panas", then: "tinggi" },
    ];

    // 3️⃣ Evaluasi setiap rule
    const fired = rules
      .map((r) => {
        const strength = mu.suhu[r.if];
        return { consequent: r.then, strength };
      })
      .filter((f) => f.strength > 0);

    // 4️⃣ Agregasi hasil (max of clipped consequents)
    const step = 10; // resolusi
    const xs = [];
    const mus = [];

    for (let y = OUTPUT_MIN; y <= OUTPUT_MAX; y += step) {
      let agg = 0;
      for (const f of fired) {
        const mfVal = MF_Produksi[f.consequent](y);
        const clipped = Math.min(f.strength, mfVal);
        agg = Math.max(agg, clipped);
      }
      xs.push(y);
      mus.push(agg);
    }

    // 5️⃣ Defuzzifikasi (metode centroid)
    let num = 0,
      den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += xs[i] * mus[i];
      den += mus[i];
    }
    const crisp = den === 0 ? mean([OUTPUT_MIN, OUTPUT_MAX]) : num / den;

    // 6️⃣ Tentukan label output
    const mRendah = MF_Produksi.rendah(crisp);
    const mSedang = MF_Produksi.sedang(crisp);
    const mTinggi = MF_Produksi.tinggi(crisp);
    const maxM = Math.max(mRendah, mSedang, mTinggi);
    let label = "Tidak Tentu";
    if (maxM === mRendah) label = "Rendah";
    else if (maxM === mSedang) label = "Sedang";
    else if (maxM === mTinggi) label = "Tinggi";

    // 7️⃣ Konversi hasil ke liter & nominal
    const produksiMl = Math.round(crisp);
    const produksiLiter = +(produksiMl / 1000).toFixed(2);
    const pendapatan = produksiMl * 10; // 1 ml = Rp10

    return {
      suhu,
      label,
      produksiMl,
      produksiLiter,
      pendapatan,
      debug: {
        mu,
        rules: fired,
        crisp,
      },
    };
  }

  /** Helper rata-rata */
  function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  // Ekspor ke global scope
  global.FuzzyPrediksi = {
    loadData,
    infer,
    get data() {
      return DATA_PENJUALAN;
    },
  };
})(window);
