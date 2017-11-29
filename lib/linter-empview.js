'use babel';

import {CompositeDisposable} from 'atom';
// import { Point, Range } from 'atom';
import {extname} from 'path';
// import { readFile } from 'fs';
import sax from 'sax';

const grammarScopes = [];
const sStartEdge = "#{";
const sEndEdge = "}#";
const sErrMsgStart = "slt2未闭合的, 缺少起始标识!"
const sErrMsgEnd = "slt2未闭合的, 缺少结束标识!"
let subscriptions;
export default {

    activate(state) {
        // console.log("initial ------------------");
        require('atom-package-deps').install('linter-empview');
        // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
        this.subscriptions = new CompositeDisposable();

        this.subscriptions.add(atom.config.observe('linter-empview.enabledScopes', (scopes) => {
            // Remove any old scopes

            grammarScopes.splice(0, grammarScopes.length);
            // Add the current scopes
            Array.prototype.push.apply(grammarScopes, scopes);
        }));

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
                    // console.log("sax ------------------");
                    //    console.log(sax);
                    let strict = true;
                    let parser = sax.parser(strict);
                    var oErrObjs = {
                        iList: []
                    }

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
                        // console.log("end -------------------");
                        //   resolve([])
                        // console.log("end -------------------",oErrObjs);
                        // console.log(format_err(editor.getPath(), oErrObjs));
                        resolve(format_err(editor.getPath(), oErrObjs));
                    };

                    try {
                        let editorText = editor.getText();
                        // 之后做性能优化
                        // 预处理页面内容, 筛除 slt2内容, 转化 slt2 >>> 为\n,
                        // 这样做的目的是筛除 slt2 后仍保持页面错误定位准确

                        let aSplitRe = editorText.split(/#{|}#/ig);
                        // console.log(aSplitRe, aSplitRe.length);

                        // 判断筛除 slt2 分隔符之后, 代码段是否为奇数个
                        // 如果不是, 则表明 slt2 分隔符未闭合
                        if (aSplitRe.length & 1) {
                            let aNewRe = []
                            for (let i = 0; i < aSplitRe.length; i++) {
                                if (!(i & 1)) {
                                    aNewRe.push(aSplitRe[i]);
                                } else {
                                    sSlt = aSplitRe[i];
                                    aRe = sSlt.match(/\n/ig);
                                    // console.log(i, sSlt, aRe);
                                    if (aRe) {
                                        aNewRe = aNewRe.concat(aRe);
                                    }
                                }
                            }
                            let sText = aNewRe.join("");

                            // editorText = editorText.replace(/#{[^#]*}#/ig, "");
                            // editorText = editorText.replace(/#{[^}]*}#/ig, "");
                            // console.log(editorText);
                            // console.log(sText);
                            parser.write(sText).close();
                        } else {
                            // console.log(" error slt2");
                            let iStartIndex = 0;
                            let iEndIndex = 0;
                            let iPreStartIndex = 0;
                            let iPreEndIndex = 0;
                            let aErrArr = [];
                            do {
                                // console.log("new loop:", iStartIndex, iEndIndex);
                                iStartIndex = editorText.indexOf(sStartEdge, iStartIndex + 1);
                                iEndIndex = editorText.indexOf(sEndEdge, iEndIndex + 1);

                                if ((iStartIndex == -1) && (iEndIndex == -1)) {
                                    // end
                                    console.log("parse end");
                                    break;
                                }

                                if (iStartIndex == -1) {
                                    // 未闭合
                                    // 返回缺失位置
                                    let [iLine, iCol] = get_error_position(editorText, iEndIndex);

                                    aErrArr.push(new_slt_linter_msg(editor.getPath(), iLine, iCol, sErrMsgStart));
                                    break;
                                }

                                if (iEndIndex == -1) {
                                    // 未闭合
                                    // 返回缺失位置
                                    let [iLine, iCol] = get_error_position(editorText, iStartIndex);

                                    aErrArr.push(new_slt_linter_msg(editor.getPath(), iLine, iCol, sErrMsgEnd));
                                    break;
                                }

                                // 起始符错误
                                if (iStartIndex > iEndIndex) {
                                    // console.log("Line error:", get_error_position(editorText, iEndIndex));
                                    console.log("start edge error:", iStartIndex, iEndIndex);
                                    let [iLine, iCol] = get_error_position(editorText, iEndIndex);

                                    aErrArr.push(new_slt_linter_msg(editor.getPath(), iLine, iCol, sErrMsgStart));
                                    break;
                                } else if (iStartIndex < iPreEndIndex) { // 上个结束符符错误
                                    // console.log("Line error:", get_error_position(editorText, iPreStartIndex));
                                    // console.log("end edge error:", iStartIndex, iPreEndIndex);
                                    let [iLine, iCol] = get_error_position(editorText, iPreStartIndex);
                                    aErrArr.push(new_slt_linter_msg(editor.getPath(), iLine, iCol, sErrMsgEnd));
                                    break;
                                }
                                iPreStartIndex = iStartIndex;
                                iPreEndIndex = iEndIndex;
                            } while (iStartIndex < editorText.length);
                            // console.log("edge error --------", iStartIndex, iEndIndex);
                            // console.log(aErrArr);
                            resolve(aErrArr);
                        }
                    } catch (err) {
                        //    console.log("2222222222--------------------------------------");
                        //    console.log(oErrObjs);
                        resolve(format_err(editor.getPath(), oErrObjs));
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
    aList.forEach((iIndex) => {
        aRe.push(new_linter_msg(editorPath, oErrObjs[iIndex]))
    });
    return aRe;
}

new_linter_msg = (editorPath, oErr) => {
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

get_error_position = (sText, iStartIndex) => {
    let sTmpText = sText.substring(0, iStartIndex);
    // console.log(sTmpText);
    // let aTmpText = sTmpText.match(/\n/ig)
    let aTmpText = sTmpText.split(/\n/ig);
    let iLine = 0;
    let iCol = 0;
    let iReLen = aTmpText.length;
    if (iReLen > 1) {
        iLine = aTmpText.length - 1;
        iCol = aTmpText[iReLen - 1].length
    }
    return [iLine, iCol]

}

new_slt_linter_msg = (editorPath, iLine, iCol, sMsg) => {
    let start = [iLine, 0];
    let stop = [
        iLine, iCol + 2
    ];
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

// [{
//     severity: 'info',
//     location: {
//       file: editorPath,
//       position: [[0, 0], [0, 1]],
//     },
//     excerpt: `A random value is ${Math.random()}`,
//     description: `### What is this?\nThis is a randomly generated value`
// }]
