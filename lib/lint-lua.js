'use babel';
import {parse} from './luaparse';
const EMBEDDEDSTART = "[CDATA[";
const EMBEDDEDEND = "]]>";

export default {
    lintLua(editor, editorText) {
        // let editor = atom.workspace.getActiveTextEditor();
        // let editorText = editor.getText();
        let sLuaStr = get_lua_text(editorText);
            try {
                parse(sLuaStr);
                return [];
            } catch (err) {
                // console.log(err);
                let iLine = err.line - 1
                let iCol = err.column
                let oLineRange = editor.getBuffer().rangeForRow(iLine, false)
                let sMessage = err.message.match(/\[\d+:\d+] (.*)/)[1]
                return [new_lua_linter_msg(editor.getPath(), iLine, iCol, oLineRange, sMessage)];
            }
    }

}

get_lua_text = (editorText) => {
    let aNewRe = [];
    let iStartIndex = editorText.indexOf(EMBEDDEDSTART);
    let iEndIndex = editorText.indexOf(EMBEDDEDEND);
    while ((iStartIndex && iEndIndex)> -1) {

        let sBeforStr = editorText.substring(0, iStartIndex);
        let aRe = sBeforStr.match(/\n/ig);

        if (aRe) {
            aNewRe = aNewRe.concat(aRe);
        }

        let sLuaStr = editorText.substring(iStartIndex + 7, iEndIndex);
        aNewRe.push(sLuaStr);

        // console.log(aNewRe.length);
        iStartIndex = editorText.indexOf(EMBEDDEDSTART, iStartIndex+7+1);
        iEndIndex = editorText.indexOf(EMBEDDEDEND, iEndIndex + 3+1);
        // console.log(iStartIndex, iEndIndex, iStartIndex && iEndIndex);

    }
    return  aNewRe.join("");
}

new_lua_linter_msg = (editorPath, iLine, iCol, oRange, sMsg) => {
    let start = [iLine, iCol];
    let stop = [iLine, oRange.end.column];
    let excerpt = sMsg;
    let desc = "";
    return {
        severity: 'error',
        location: {
            file: editorPath,
            position: [start, stop]
        },
        excerpt: excerpt,
        description: desc
    }
}
