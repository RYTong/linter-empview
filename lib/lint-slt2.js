'use babel';

const sStartEdge = "#{";
const sEndEdge = "}#";
const sErrMsgStart = "slt2未闭合的, 缺少起始标识!"
const sErrMsgEnd = "slt2未闭合的, 缺少结束标识!"

export default {
    lintSLT2(editorText, editorPath) {
        console.log(" error slt2");
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
                break;
            }

            if ((iStartIndex == -1) || (iEndIndex == -1)) {
                if (iStartIndex == -1) {
                    // 未闭合,返回缺失位置
                    let [iLine, iCol] = get_error_position(editorText, iEndIndex);
                    aErrArr.push(new_slt_linter_msg(editorPath, iLine, iCol, sErrMsgStart));
                    break;
                }

                if (iEndIndex == -1) {
                    // 未闭合,返回缺失位置
                    let [iLine, iCol] = get_error_position(editorText, iStartIndex);
                    aErrArr.push(new_slt_linter_msg(editorPath, iLine, iCol, sErrMsgEnd));
                    break;
                }
            }

            // 起始符错误
            if ((iStartIndex > iEndIndex) || (iStartIndex < iPreEndIndex)) {
                if (iStartIndex > iEndIndex) {
                    // console.log("Line error:", get_error_position(editorText, iEndIndex));
                    // console.log("start edge error:", iStartIndex, iEndIndex);
                    let [iLine, iCol] = get_error_position(editorText, iEndIndex);

                    aErrArr.push(new_slt_linter_msg(editorPath, iLine, iCol, sErrMsgStart));
                    break;
                } else if (iStartIndex < iPreEndIndex) {
                    // 上个结束符符错误
                    // console.log("Line error:", get_error_position(editorText, iPreStartIndex));
                    // console.log("end edge error:", iStartIndex, iPreEndIndex);
                    let [iLine, iCol] = get_error_position(editorText, iPreStartIndex);
                    aErrArr.push(new_slt_linter_msg(editorPath, iLine, iCol, sErrMsgEnd));
                    break;
                }
            }
            iPreStartIndex = iStartIndex;
            iPreEndIndex = iEndIndex;
        } while (iStartIndex < editorText.length);
        return aErrArr;
    }
};

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
