/** The two Blockly themes of the old app: big friendly picture blocks and Scratch-like text blocks. */
import * as Blockly from 'blockly/core';

const style = (primary: string, secondary: string, tertiary: string) => ({ colourPrimary: primary, colourSecondary: secondary, colourTertiary: tertiary });

let themes: { picture: Blockly.Theme; text: Blockly.Theme } | null = null;

export function blocklyThemes(): { picture: Blockly.Theme; text: Blockly.Theme } {
  if (themes) return themes;
  themes = {
    picture: Blockly.Theme.defineTheme('mc-picture', {
      name: 'mc-picture',
      base: Blockly.Themes.Classic,
      startHats: true,
      fontStyle: { family: '"Baloo 2", sans-serif', weight: '800', size: 15 },
      componentStyles: {
        workspaceBackgroundColour: '#FFFDF8', flyoutBackgroundColour: '#EAF6FF', flyoutOpacity: 1, scrollbarColour: '#C9D9EC', scrollbarOpacity: 0.9,
        insertionMarkerColour: '#241A4D', insertionMarkerOpacity: 0.25,
      },
      blockStyles: {
        f_event: style('#FFC21A', '#E6A800', '#C58F00'),
        f_move: style('#3D8BFF', '#2C74E0', '#1F5DBD'),
        f_look: style('#8E5CF7', '#7A48E0', '#6436C4'),
        f_sound: style('#D05CD0', '#B848B8', '#9A369A'),
        f_ctrl: style('#FF8A1F', '#E67300', '#C25F00'),
        f_msg: style('#1FB5A8', '#14998E', '#0E8277'),
        f_score: style('#EF5DA8', '#D9468F', '#BC2F76'),
      },
    }),
    text: Blockly.Theme.defineTheme('mc-text', {
      name: 'mc-text',
      base: Blockly.Themes.Classic,
      startHats: true,
      fontStyle: { family: '"Atkinson Hyperlegible", sans-serif', weight: '700', size: 12 },
      componentStyles: {
        workspaceBackgroundColour: '#F9F7FC', toolboxBackgroundColour: '#FBF6EC', toolboxForegroundColour: '#241A4D', flyoutBackgroundColour: '#F0ECF7',
        flyoutOpacity: 1, scrollbarColour: '#CFC6E2', scrollbarOpacity: 0.9, insertionMarkerColour: '#241A4D', insertionMarkerOpacity: 0.25,
      },
      blockStyles: {
        a_events: style('#FFBF00', '#E6AC00', '#CC9900'),
        a_motion: style('#4C97FF', '#4280D7', '#3373CC'),
        a_looks: style('#9966FF', '#855CD6', '#774DCB'),
        a_sound: style('#CF63CF', '#C94FC9', '#BD42BD'),
        a_control: style('#FFAB19', '#EC9C13', '#CF8B17'),
        a_sensing: style('#5CB1D6', '#47A8D1', '#2E8EB8'),
        a_ops: style('#59C059', '#46B946', '#389438'),
        a_points: style('#17B3A3', '#119E90', '#0C8478'),
        a_vars: style('#FF8C1A', '#FF8000', '#DB6E00'),
        a_lists: style('#FF661A', '#FF5500', '#E64D00'),
      },
    }),
  };
  return themes;
}
