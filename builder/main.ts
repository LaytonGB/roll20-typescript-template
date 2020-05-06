const API_NAME = (function() {
  const version = '1.0.0';

  type StateVar = 'valueName';

  type ActiveValue = 'true' | 'false';
  function isActiveValue(val: string): val is ActiveValue {
    return ['true', 'false'].includes(val);
  }

  type valueName = 'val1' | 'val2';
  function isValueName(val: string): val is valueName {
    return ['val1', 'val2'].includes(val);
  }

  /**
   * This is the interface used to check the "states" object, and to ensure that
   * all Roll20 state object changes go smoothly.
   * @param name A name for this setting. Because this name is to be added to the
   * states object, it is best to keep this name uniform.
   * @param acceptables Optional. Acceptable values for this state.
   * @param default Optional. The default value for this state.
   * @param ignore Optional. If true, this state will not be reset to default
   * regardless of if its current value is outside its acceptable values.
   * @param hide Optional. If true, this state will not show in the config menu.
   * @param customConfig Optional. Sets a custom dropdown menu for the config button.
   */
  interface StateForm {
    name: StateVar;
    acceptables?: string[];
    default?: string;
    ignore?: ActiveValue;
    hide?: ActiveValue;
    customConfig?: string;
  }

  interface MacroForm {
    name: string;
    action: string;
    visibleto?: string;
  }

  interface HelpForm {
    name: string;
    desc: string[];
    example?: string[];
    link?: StateVar;
  }

  const stateName = 'API_NAME';
  const states: StateForm[] = [
    {
      name: 'valueName'
    }
  ];
  const name = 'API_NAME';
  const nameError = name + ' ERROR';
  const nameLog = name + ': ';
  const apiCall = '!apiCall';

  let playerName: string, playerID: string, parts: string[];

  /**
   * Checks each macro from the macroArr array to ensure their functions are up to date.
   */
  function checkMacros() {
    const playerList = findObjs({ _type: 'player', _online: true });
    const gm = playerList.find((player) => {
      return playerIsGM(player.id) === true;
    }) as Player;
    const macroArr: MacroForm[] = [
      // {
      //   name: 'MacroName',
      //   action: `${apiCall}`
      // }
    ];
    macroArr.forEach((macro) => {
      const macroObj = findObjs({
        _type: 'macro',
        name: macro.name
      })[0] as Macro;
      if (macroObj) {
        if (macroObj.get('visibleto') !== 'all') {
          macroObj.set('visibleto', 'all');
          toChat(`**Macro '${macro.name}' was made visible to all.**`, true);
        }
        if (macroObj.get('action') !== macro.action) {
          macroObj.set('action', macro.action);
          toChat(`**Macro '${macro.name}' was corrected.**`, true);
        }
      } else if (gm && playerIsGM(gm.id)) {
        createObj('macro', {
          _playerid: gm.id,
          name: macro.name,
          action: macro.action,
          visibleto: 'all'
        });
        toChat(
          `**Macro '${macro.name}' was created and assigned to ${gm.get(
            '_displayname'
          ) + ' '.split(' ', 1)[0]}.**`,
          true
        );
      }
    });
  }

  /**
   * Outputs help interface to the roll20 chat.
   */
  function showHelp() {
    const commandsArr: HelpForm[] = [
      // {
      //   name: `${apiCall} help`,
      //   desc: ['Lists all commands, their parameters, and their usage.']
      // }
    ];
    toChat(
      '&{template:default} {{name=' +
        '**VERSION**' +
        '}} {{Current=' +
        version +
        '}}',
      undefined,
      playerName
    );
    commandsArr.forEach((command) => {
      let output =
        '&{template:default} {{name=' + code(command.name) + '}}{{Function=';
      for (let i = 0; i < command.desc.length; i++) {
        if (i % 2 === 1) {
          output += '{{=';
        }
        output += command.desc[i] + '}}';
      }
      if (command.link !== undefined) {
        output += '{{Current Setting=' + getState(command.link) + '}}';
      }
      toChat(output, undefined, playerName);
    });
  }

  function showConfig() {
    let output = `&{template:default} {{name=${name} Config}}`;
    states.forEach((s) => {
      if (s.hide == 'true') {
        return;
      }
      const acceptableValues = s.acceptables
        ? s.acceptables
        : ['true', 'false'];
      const defaultValue = s.default ? s.default : 'true';
      const currentValue = getState(s.name);
      const stringVals =
        s.customConfig == undefined
          ? valuesToString(acceptableValues, defaultValue)
          : s.customConfig;
      output += `{{${s.name}=[${currentValue}](${apiCall} config ${s.name} ?{New ${s.name} value${stringVals}})}}`;
    });
    output += `{{**CAUTION**=[CLEAR ALL](!&#13;?{Are you sure? All custom paladin targets will be lost|Cancel,|I am sure,${apiCall} RESET})}}`;
    toChat(output, undefined, playerName);

    /**
     * Moves the default value to the start of the array and presents
     * all acceptable values in a drop-down menu format.
     * @param values Acceptable values array.
     * @param defaultValue The state's default value.
     */
    function valuesToString(values: string[], defaultValue: string) {
      let output = '';
      const index = values.indexOf(defaultValue);
      if (index !== -1) {
        values.splice(index, 1);
        values.unshift(defaultValue);
      }
      values.forEach((v) => {
        output += '|' + v;
      });
      return output;
    }
  }

  /**
   * Sets the setting with name equal to @param parts[2] equal to @param parts[3].
   * @param parts An Array of strings, each part is a section of the incoming message.
   */
  function setConfig(parts: string[]): void {
    toChat(
      '**' +
        parts[2] +
        '** has been changed **from ' +
        getState(parts[2] as StateVar) +
        ' to ' +
        parts[3] +
        '**.',
      true,
      'gm'
    );
    setState(parts[2] as StateVar, parts[3]);
    showConfig();
  }

  function handleInput(msg: ApiChatEventData) {
    parts = msg.content.split('--').map((s) => {
      return s.trim();
    });
    if (msg.type == 'api' && parts[0] == apiCall) {
      playerName = msg.who.split(' ', 1)[0];
      playerID = msg.playerid;
      if (['possible command'].includes(parts[1])) {
        MAIN_API();
      } else {
        error('Command ' + code(msg.content) + ' not understood.', 0);
      }
    }
  }

  function MAIN_API() {}

  /**
   * @param charID A character ID string.
   * @param name The attribute name.
   * @returns The attribute if found, else undefined.
   */
  function getAttr(charID: string, name: string): Attribute {
    const attrs = findObjs({
      _type: 'attribute',
      _characterid: charID,
      name: name
    }) as Attribute[];
    if (attrs.length > 0) {
      return attrs[0];
    }
    return;
  }

  /**
   * Find the attribute and sets its 'current' value. If the attribute
   * cannot be found it is instead created.
   * @param charID A character ID string.
   * @param name The attribute name.
   * @param value The value to set the attribute to.
   * @param dontOverwrite If true, the attribute's current value will not be overwritten,
   * unless the attribute was newly created.
   * @returns The attribute after the change.
   */
  function setAttr(
    charID: string,
    name: string,
    value?: string,
    dontOverwrite?: boolean
  ): Attribute {
    let attr = getAttr(charID, name);
    let goingToOverwrite: boolean;
    if (attr == undefined || attr.get('current').trim() == '') {
      goingToOverwrite = false;
      attr = createObj('attribute', {
        _characterid: charID,
        name: name
      });
    }
    if (
      value != undefined &&
      // so long as goingToOverwrite and dontOverwrite are not both true
      (goingToOverwrite == false || dontOverwrite != true)
    ) {
      attr.setWithWorker('current', value);
    }
    return attr;
  }

  // can also return a string in the case of "status_marker" StateVar, but is never checked by code
  function getState(
    value: StateVar
  ) {
    return state[stateName][value];
  }

  function setState(targetState: StateVar, newValue: string): void {
    let valid: boolean;
    switch (targetState) {
      case 'valueName':
        valid = isValueName(newValue);
        break;
    }
    if (valid) {
      state[stateName][targetState] = newValue;
    } else {
      error(
        'Tried to set state "' +
          targetState +
          '" with unacceptable value "' +
          newValue +
          '".',
        -2
      );
    }
  }

  function code(snippet: string) {
    return (
      '<span style="background-color: rgba(0, 0, 0, 0.5); color: White; padding: 2px; border-radius: 3px;">' +
      snippet +
      '</span>'
    );
  }

  function toChat(message: string, success?: boolean, target?: string): void {
    const whisper = target ? '/w ' + target + ' ' : '';
    let style = '<div>';
    if (success === true) {
      style =
        '<br><div style="background-color: #5cd65c; color: Black; padding: 5px; border-radius: 10px;">';
    } else if (success === false) {
      style =
        '<br><div style="background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;">';
    }
    sendChat(name, whisper + style + message + '</div>');
  }

  function error(error: string, code: number) {
    if (playerName) {
      sendChat(
        nameError,
        `/w ${playerName} <br><div style='background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;'>**${error}** Error code ${code}.</div>`
      );
    } else {
      sendChat(
        nameError,
        `<br><div style='background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;'>**${error}** Error code ${code}.</div>`
      );
    }
    log(nameLog + error + ` Error code ${code}.`);
  }

  function startupChecks() {
    checkStates();
  }

  function checkStates(): void {
    let changedStates = 0,
      lastState: string,
      lastOldValue: string,
      lastNewValue: string;
    states.forEach((s) => {
      const acceptables = s.acceptables ? s.acceptables : ['true', 'false'];
      const defaultVal = s.default ? s.default : 'true';
      if (
        getState(s.name) == undefined ||
        (!acceptables.includes(getState(s.name)) && s.ignore != 'true')
      ) {
        changedStates++;
        lastState = s.name;
        lastOldValue = getState(s.name);
        lastNewValue = defaultVal;
        setState(s.name, defaultVal);
      }
    });
    if (changedStates == 1) {
      error(
        '"' +
          lastState +
          '" value was "' +
          lastOldValue +
          '" but has now been set to its default value, "' +
          lastNewValue +
          '".',
        -1
      );
    } else if (changedStates > 1) {
      toChat(
        '**Multiple settings were wrong or un-set. They have now been corrected. ' +
          'If this is your first time running the PaladinAura API, this is normal.**',
        true
      );
    }
  }

  function registerEventHandlers() {
    on('chat:message', handleInput);
  }

  return {
    CheckMacros: checkMacros,
    StartupChecks: startupChecks,
    RegisterEventHandlers: registerEventHandlers
  };
})();

on('ready', () => {
  API_NAME.CheckMacros();
  API_NAME.StartupChecks();
  API_NAME.RegisterEventHandlers();
});
