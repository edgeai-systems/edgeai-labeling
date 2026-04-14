export async function fakeDetect() {
  return [
    { class: "car", bbox: [100, 100, 300, 250] },
    { class: "plate", bbox: [180, 220, 260, 260] }
  ];
}