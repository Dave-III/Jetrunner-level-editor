import { createJsonAdapter, identityTransform } from '../../framework';

export const jetrunnerAdapter = createJsonAdapter({
  id: 'jetrunner', displayName: 'JETRUNNER', projectSchema: 'jle-editor-project-v1',
  capabilities: { preview: true, verification: true, runtimePackaging: true, environments: true },
  config: { branding:{applicationName:'JETRUNNER Level Editor',editorTitle:'Level Editor'}, theme:{name:'jetrunner',fonts:{primary:'"Barlow Condensed", "Arial Narrow", sans-serif',monospace:'Consolas, monospace',weights:{regular:400,strong:900},baseSize:'16px'},colours:{background:'#080716',panel:'#15112c',panelAlt:'#1e1740',text:'#f7f4ff',muted:'#9189b5',accent:'#26d9ff',accentAlt:'#ff3df2',selection:'#d8ff3e',border:'#8a48ff',warning:'#ffbf35',error:'#ff3d79',success:'#d8ff3e',grid:'#26d9ff'},gradients:{primary:'linear-gradient(105deg,#17102f,#24104b 46%,#11102a)',panel:'linear-gradient(180deg,#064d70,#00233d)',home:'linear-gradient(#07163499,#07163499)'},surfaces:{button:'#4c073d',buttonHover:'#174d62',toolbar:'#2a1550',inspector:'#240019f2',overlay:'#040812f5'},controls:{radius:'2px',borderWidth:'2px',selectionGlow:'0 0 18px #d8ff3e66'},viewport:{background:'#080716',gridOpacity:.08,gizmoSize:1}}, categories:['Surface','Gameplay','Props'],snapping:{enabled:true,translation:100,rotationDegrees:15,scale:1},grid:{size:100,subdivisions:1},units:{name:'centimetres',symbol:'cm',unitsPerMetre:100},coordinates:{upAxis:'z',handedness:'left',forwardAxis:'x'},preview:{cameraPosition:{x:600,y:600,z:450},background:'#080716',physics:true},gameplayMetadata:{engine:'Unreal',packageFormat:'.pak'} },
  assets: [
    { id: 'player_start', label: 'Player Start', category: 'Gameplay', shape: 'custom', defaultTransform: identityTransform() },
    { id: 'time_trial_goal', label: 'Finish Goal', category: 'Gameplay', shape: 'custom', defaultTransform: identityTransform() },
  ],
  exportRuntime: async (project) => project,
});
