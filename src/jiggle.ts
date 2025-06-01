export default function (random: () => number) {
  return (random() - 0.5) * 1e-6;
}
