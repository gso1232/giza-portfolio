// The site's palettes, the visitor's pick (the swatches at the top right, main.js). Each is the page's own colours (CSS
// custom properties on :root) and the 3D's two tones (its shade, `shade`, and its light, `light`), plus `fluid`: the
// colours the ink ball that brings it in swirls with (inkball.js). Galaxy is the one dark one: the page goes to night
// over a live Milky Way (galaxy.js) instead of grid paper.
export const PALETTES = [
  {
    key: 'cozy', name: 'Cozy', shade: '#b9693b', light: '#f4d3b0', fluid: ['#3b1a0c', '#b9693b', '#f4d3b0', '#ffd08a'],
    css: {},                                   // (the page's own defaults: inside.css)
  },
  {
    key: 'nile', name: 'Nile', shade: '#1f5f66', light: '#e9ddc5', fluid: ['#0a2427', '#1f5f66', '#e9ddc5', '#e0a458'],
    css: {
      '--accent': '#1f5f66', '--accent-lit': '#e9ddc5', '--cta': '#174a50', '--spark': '#e0a458', '--card-2': '#2a7880', '--card-3': '#123b40', '--foot': '#0f3035', '--foot-head': '#e0a458',
      '--paper': '#ece4d2', '--grid-v': '#dccfb5', '--grid-h': '#e6dcc6', '--ink': '#14292c', '--body': '#3c5153', '--muted': '#4f6466', '--edge': '#1f3a3d', '--nav': '#fbf7eef2', '--cream': '#f8f3e8',
      '--folder': '#e6dcc7', '--folder-hi': '#efe7d6', '--folder-lo': '#ddd1b9', '--card-white': '#faf6ec', '--card-cream': '#f1ead9', '--card-h3': '#7f8c8a', '--acc': '#d9ccb2',
    },
  },
  {
    key: 'jade', name: 'Jade', shade: '#3c7a5d', light: '#ebe7d6', fluid: ['#0f261c', '#3c7a5d', '#ebe7d6', '#d6a243'],
    css: {
      '--accent': '#3c7a5d', '--accent-lit': '#ebe7d6', '--cta': '#2d5d47', '--spark': '#d6a243', '--card-2': '#4d8b6e', '--card-3': '#214434', '--foot': '#1a3529', '--foot-head': '#d6a243',
      '--paper': '#eeebdd', '--grid-v': '#dcdac6', '--grid-h': '#e7e4d3', '--ink': '#1d2c25', '--body': '#44534b', '--muted': '#55655c', '--edge': '#24382e', '--nav': '#fbfaf2f2', '--cream': '#f7f5ea',
      '--folder': '#e7e4d3', '--folder-hi': '#f0eee0', '--folder-lo': '#dddac6', '--card-white': '#fbfaf2', '--card-cream': '#f2f0e2', '--card-h3': '#8a9089', '--acc': '#d9d6c1',
    },
  },
  {
    key: 'graphite', name: 'Graphite', shade: '#55555e', light: '#e7e3db', fluid: ['#141418', '#55555e', '#e7e3db', '#e2593b'],
    css: {
      '--accent': '#55555e', '--accent-lit': '#e7e3db', '--cta': '#2f2f35', '--spark': '#e2593b', '--card-2': '#5d5d67', '--card-3': '#2b2b31', '--foot': '#1f1f24', '--foot-head': '#e2593b',
      '--paper': '#efece6', '--grid-v': '#dedad2', '--grid-h': '#e8e5de', '--ink': '#232327', '--body': '#4a4a50', '--muted': '#5b5b61', '--edge': '#2c2c31', '--nav': '#fcfbf8f2', '--cream': '#f8f7f3',
      '--folder': '#e8e5de', '--folder-hi': '#f1efea', '--folder-lo': '#ddd9d0', '--card-white': '#fcfbf8', '--card-cream': '#f3f1ec', '--card-h3': '#8d8d93', '--acc': '#dcd8cf',
    },
  },
  {
    key: 'rose', name: 'Rose', shade: '#9a4f68', light: '#f3dbd1', fluid: ['#2a0f19', '#9a4f68', '#f3dbd1', '#f0a07a'],
    css: {
      '--accent': '#9a4f68', '--accent-lit': '#f3dbd1', '--cta': '#74334c', '--spark': '#f0a07a', '--card-2': '#a85d77', '--card-3': '#5a2a3d', '--foot': '#431f2e', '--foot-head': '#f0a07a',
      '--paper': '#f4e7e0', '--grid-v': '#e8d3c9', '--grid-h': '#efdfd7', '--ink': '#3a1f2a', '--body': '#5e4049', '--muted': '#6e5059', '--edge': '#4a2a36', '--nav': '#fff8f5f2', '--cream': '#fdf5f1',
      '--folder': '#efdfd6', '--folder-hi': '#f6ebe5', '--folder-lo': '#e6d2c7', '--card-white': '#fdf8f5', '--card-cream': '#f5eae4', '--card-h3': '#9a8a8e', '--acc': '#e6d0c6',
    },
  },
  {
    key: 'galaxy', name: 'Milky Way', shade: '#2b2360', light: '#b9aef2', fluid: ['#07061a', '#3d2f8f', '#b9aef2', '#ffd38a'], dark: true,
    css: {
      '--accent': '#6d5cf0', '--accent-lit': '#b9aef2', '--cta': '#5b46d6', '--spark': '#ffd38a', '--card-2': '#4b39b8', '--card-3': '#1d1748', '--foot': '#0b0a20b8', '--foot-head': '#ffd38a',
      '--paper': 'transparent', '--grid-v': '#ffffff08', '--grid-h': '#ffffff06', '--ink': '#efeaff', '--body': '#cbc4ec', '--muted': '#a7a0d4', '--edge': '#b8aeff66', '--nav': '#14113199', '--cream': '#f3f0ff',
      '--folder': '#100d2aa3', '--folder-hi': '#1b1640a3', '--folder-lo': '#0b0920a3', '--card-white': '#ffffff12', '--card-cream': '#ffffff1a', '--card-h3': '#a7a0d4', '--acc': '#ffffff1f', '--menu': '#17133d',
    },
  },
];
export const byKey = (k) => PALETTES.find((p) => p.key === k) ?? PALETTES[0];
