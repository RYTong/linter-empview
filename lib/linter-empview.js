'use babel';

import {CompositeDisposable} from 'atom';
import {install} from 'atom-package-deps';
import {parse} from 'luaparse';
// import { Point, Range } from 'atom';
import {extname} from 'path';
// import { readFile } from 'fs';
import sax from 'sax';
import {lintSLT2} from './lint-slt2';
import {lintLua} from './lint-lua';
import $ from 'jquery';

const grammarScopes = [];
const sStartEdge = "#{";
const sEndEdge = "}#";
const sErrMsgStart = "slt2未闭合的, 缺少起始标识!"
const sErrMsgEnd = "slt2未闭合的, 缺少结束标识!"
let bEnableLua = false;
let subscriptions;
export default {

    activate(state) {
        // console.log("initial ------------------");
        // require('atom-package-deps').
        install('linter-empview');
        // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
        this.subscriptions = new CompositeDisposable();
        bEnableLua = atom.config.get("linter-empview.enableLintEmbeddedLua");
        atom.config.onDidChange("linter-empview.enableLintEmbeddedLua", {}, () => {
            bEnableLua = atom.config.get("linter-empview.enableLintEmbeddedLua");
        });

        // this.subscriptions.add(atom.config.observe('linter-empview.enabledScopes', (scopes) => {
        //      Remove any old scopes
        //
        //     grammarScopes.splice(0, grammarScopes.length);
        //      Add the current scopes
        //     Array.prototype.push.apply(grammarScopes, scopes);
        // }));

    },

    deactivate() {
        this.subscriptions.dispose();
    },

    serialize() {
        return {
            //   linterEmpviewViewState: this.linterEmpviewView.serialize()
        };
    },

    provideLinter() {
        return {
            name: 'EMPViewlint',
            grammarScopes: ['source.emp'],
            scope: 'file',
            lintsOnChange: false,
            lint: (editor) => {

                return new Promise(function(resolve, reject) {
                    let oErrObjs = {
                        iList: []
                    };
                    let editorPath = editor.getPath();
                    let editorText = editor.getText();
                    try {
                        // console.log("slt2 -----------------");
                        let aErrArr = lintSLT2(editorText, editorPath);
                        if (aErrArr.length) {
                            mark_err(editorPath);
                            resolve(aErrArr);
                        } else {
                            // console.log("sax ------------------");
                            let strict = true;
                            let parser = sax.parser(strict);

                            // 之后做性能优化
                            // 预处理页面内容, 筛除 slt2内容, 转化 slt2 >>> 为\n,
                            // 这样做的目的是筛除 slt2 后仍保持页面错误定位准确

                            let aSplitRe = editorText.split(/#{|}#/ig);
                            // console.log(aSplitRe, aSplitRe.length);

                            // 判断筛除 slt2 分隔符之后, 代码段是否为奇数个
                            // 如果不是, 则表明 slt2 分隔符未闭合 >>>
                            // 不准确,已修改为比作 slt 校验
                            // console.log(aSplitRe.length & 1);

                            let aNewRe = []
                            for (let i = 0; i < aSplitRe.length; i++) {
                                if (!(i & 1)) {
                                    aNewRe.push(aSplitRe[i]);
                                } else {
                                    sSlt = aSplitRe[i];
                                    let aRe = sSlt.match(/\n/ig);
                                    // console.log(i, sSlt, aRe);
                                    if (aRe) {
                                        aNewRe = aNewRe.concat(aRe);
                                    }
                                }
                            }
                            let sText = aNewRe.join("");

                            parser.onerror = function(e) {
                                // an error happened.
                                // console.log("+++error:", e);
                                store_err(oErrObjs, e.message);
                            };
                            parser.ontext = function(t) {
                                // got some text.  t is the string of text.
                            };
                            parser.onopentag = function(node) {
                                // opened a tag.  node has "name" and "attributes"
                            };
                            parser.onattribute = function(attr) {
                                // an attribute.  attr has "name" and "value"
                            };
                            parser.onend = function() {
                                // parser stream is done, and ready to have more stuff written to it.
                                // console.log("end -------------------",oErrObjs);
                                if (oErrObjs.iList.length) {
                                    mark_err(editorPath);
                                    resolve(format_err(editorPath, oErrObjs));
                                } else {
                                    // let bEnableLua = atom.config.get("linter-empview.enableLintEmbeddedLua");
                                    // console.log(bEnableLua);
                                    if (bEnableLua) {
                                        let oLuaErr = lintLua(editor, sText);
                                        // console.log(oLuaErr);
                                        if (oLuaErr.length) {
                                            mark_err(editorPath);
                                            return resolve(oLuaErr);
                                        }
                                    }
                                    unmark_err(editorPath);
                                    resolve([]);


                                }

                            };

                            // editorText = editorText.replace(/#{[^#]*}#/ig, "");
                            // editorText = editorText.replace(/#{[^}]*}#/ig, "");
                            // console.log(editorText);
                            // console.log(sText);
                            parser.write(sText).close();
                        }

                    } catch (err) {
                        //    console.log(oErrObjs);
                        mark_err(editorPath);
                        resolve(format_err(editorPath, oErrObjs));
                    }
                });

            }
        }
    }
};

store_err = (oErrObjs, sErrorMsg) => {
    let tmpList = sErrorMsg.split('\n');
    let sMsg = tmpList[0];
    let sLine = tmpList[1].replace(/Line:\s/ig, '');
    let sCol = tmpList[2].replace(/Column:\s/ig, '');
    // console.log("error : ============:", sLine, sCol);

    let iLine = parseInt(sLine);
    let iCol = parseInt(sCol);
    if (oTmpObj = oErrObjs[sLine]) {
        if (iCol < oTmpObj.mincol) {
            oTmpObj.mincol = iCol;
            oTmpObj.start = [iLine, iCol];
        } else if (iCol > oTmpObj.maxcol) {
            oTmpObj.maxcol = iCol
            oTmpObj.stop = [iLine, iCol];
        }
        oTmpObj.msg = sMsg;
    } else {
        oErrObjs[sLine] = new_err_info(iLine, iCol, iLine, iCol, sMsg)
        oErrObjs.iList.push(sLine);
    }
}
new_err_info = (iLine, iCol, iStopLine, iStopCol, sMsg) => {
    return {
        line: iLine,
        mincol: iCol,
        maxcol: iStopCol,
        start: [
            iLine, iCol
        ],
        stop: [
            iStopLine, iStopCol
        ],
        msg: sMsg
    }
}

format_err = (editorPath, oErrObjs) => {
    let aList = oErrObjs.iList;
    var aRe = [];
    // console.log(aList);
    aList.forEach((iIndex) => {
        aRe.push(new_linter_msg(editorPath, oErrObjs[iIndex]))
    });
    return aRe;
}

new_linter_msg = (editorPath, oErr) => {
    // console.log(oErr);
    let start = oErr.start;
    let stop = oErr.stop;
    let excerpt = oErr.msg;
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

let unmark_err = (editorPath) => {
    $('.tree-view').find(`[data-path="${editorPath}"]`)
      .removeClass('lua-syntax-error-filename')
    $('.texteditor').find(`[data-path="${editorPath}"]`)
      .removeClass('lua-syntax-error-filename')
}

let mark_err = (editorPath) => {
    $('.tree-view').find(`[data-path="${editorPath}"]`)
      .addClass('lua-syntax-error-filename')
    $('.texteditor').find(`[data-path="${editorPath}"]`)
      .addClass('lua-syntax-error-filename')
}

// [{
//     severity: 'info',
//     location: {
//       file: editorPath,
//       position: [[0, 0], [0, 1]],
//     },
//     excerpt: `A random value is ${Math.random()}`,
//     description: `### What is this?\nThis is a randomly generated value`
// }]
