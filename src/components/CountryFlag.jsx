const flags = import.meta.glob('../assets/flags/*.svg', { eager: true, query: '?url', import: 'default' });

export default function CountryFlag({ country }) {
  const source = flags[`../assets/flags/${country?.toLowerCase()}.svg`];
  return source ? <img className="issb-country-flag" src={source} alt="" aria-hidden="true" /> : null;
}
