'use babel';

import { CompositeDisposable } from 'atom';
// import { Point, Range } from 'atom';
import { extname } from 'path';
// import { readFile } from 'fs';
import  sax from 'sax';

const grammarScopes = [];
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
       name:'EMPViewlint',
       grammarScopes: ['source.emp'],
       scope: 'file',
       lintsOnChange: true,
       lint: (editor) =>{

           return new Promise(function(resolve, reject) {
            //    console.log("sax ------------------");
            //    console.log(sax);
               strict = true;
               parser = sax.parser(strict);
               var oErrObjs = {iList:[]}

               parser.onerror = function (e) {
                 // an error happened.
                //  console.log("+++error:", e);
                 store_err(oErrObjs, e.message);
               };
               parser.ontext = function (t) {
                 // got some text.  t is the string of text.
               };
               parser.onopentag = function (node) {
                 // opened a tag.  node has "name" and "attributes"
               };
               parser.onattribute = function (attr) {
                 // an attribute.  attr has "name" and "value"
               };
               parser.onend = function () {
                 // parser stream is done, and ready to have more stuff written to it.
                //  console.log("end -------------------");
               //   resolve([])
                //  console.log(oErrObjs);
                 resolve(format_err(editor.getPath(), oErrObjs));
               };

               try {
                   editorText = editor.getText();
                   editorText = editorText.replace(/\#\{/ig, "<!--");
                   editorText = editorText.replace(/\}\#/ig, "-->");
                   parser.write(editorText).close();
               } catch (err){
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
    tmpList = sErrorMsg.split('\n');
    sMsg = tmpList[0];
    sLine = tmpList[1].replace(/Line:\s/ig, '');
    sCol = tmpList[2].replace(/Column:\s/ig, '');

    // console.log("error : ============:", sLine, sCol);

    iLine = parseInt(sLine);
    iCol = parseInt(sCol);
    if (oTmpObj = oErrObjs[sLine]) {
        if (iCol < oTmpObj.mincol){
            oTmpObj.mincol = iCol;
            oTmpObj.start = [iLine, iCol];
        } else if (iCol > oTmpObj.maxcol) {
            oTmpObj.maxcol = iCol
            oTmpObj.stop = [iLine, iCol];
        }
        oTmpObj.msg = sMsg;
    }else {
        oErrObjs[sLine] = new_err_info(iLine, iCol, sMsg)
        oErrObjs.iList.push(sLine);
    }
}
new_err_info = (iLine, iCol, sMsg) => {
    return {
        line:iLine,
        mincol:iCol,
        maxcol:iCol,
        start:[iLine, iCol],
        stop:[iLine, iCol],
        msg:sMsg
    }
}

format_err = (editorPath, oErrObjs) => {
    iList = oErrObjs.iList;
    var aRe = [];
    iList.forEach( (iIndex) => {
        aRe.push(new_linter_msg(editorPath, oErrObjs[iIndex]))
    });
    return aRe;
}


new_linter_msg = (editorPath, oErr) => {
    start = oErr.start;
    stop = oErr.stop;
    excerpt = oErr.msg;
    desc = "";
    return {
        severity: 'error',
        location: {
          file: editorPath,
          position: [start, stop],
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
