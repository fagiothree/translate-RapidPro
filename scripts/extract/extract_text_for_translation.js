const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const input_file = args[0];
const output_dir = args[1];

const json_string = fs.readFileSync(input_file).toString();
const obj = JSON.parse(json_string);

//obj = reorder_flows_alphabetically_by_name(obj);
const bits = extract_bits_to_be_translated(obj);
const file_for_transl = create_file_for_translators(bits);
const file_for_transl_no_rep = remove_repetitions(file_for_transl);

writeOutputFile(output_dir, "step_1.json", bits);
writeOutputFile(output_dir, "step_2.json", file_for_transl);
writeOutputFile(output_dir, "step_3.json", file_for_transl_no_rep);

/////////////////////////////////////////////////////////////////
// functions to create files for translators
///////////////////////////////////////////////////////////////

function writeOutputFile(outputDir, filename, data) {
    const output_file = path.join(output_dir, filename);
    const json = JSON.stringify(data, null, 2);
    fs.writeFile(
        output_file,
        json,
        output_file_error_handler
    );
}

function output_file_error_handler(err) {
    if (err)  {
        console.log('error', err);
    }
}

///////////////////////////////////////////////////////////////////////////////
 function reorder_flows_alphabetically_by_name(obj) {
    obj.flows.sort(function (a, b) {
        var x = a.name.toLowerCase();
        var y = b.name.toLowerCase();
        if (x < y) { return -1; }
        if (x > y) { return 1; }
        return 0;
    });
    return obj;
}


/////////////////////////////////////////////
////////////////////////// step 1

 function extract_bits_to_be_translated(obj) {
    var bits_to_translate = {};
    var localization = {};
    var eng_localization = {};

    var word_tests = ["has_any_word", "has_all_words", "has_phrase", "has_only_phrase", "has_beginning"];

    var bits_lengths = [];

    for (var fl = 0; fl < obj.flows.length; fl++) {
        for (var n = 0; n < obj.flows[fl].nodes.length; n++) {
            for (var ac = 0; ac < obj.flows[fl].nodes[n].actions.length; ac++) {
                var curr_act = obj.flows[fl].nodes[n].actions[ac];
                if (curr_act.type == "send_msg") {
                    var msg_id = curr_act.uuid;
                    var trasl_to_add = {};
                    trasl_to_add.text = [curr_act.text];
                    trasl_to_add.quick_replies = curr_act.quick_replies;
                    eng_localization[msg_id] = trasl_to_add;

                    var char_count = curr_act.text.length;
                    curr_act.quick_replies.forEach(qr =>{
                        char_count = char_count + qr.length;
                    })
                    if (curr_act.quick_replies.length >0){
                        char_count +=50;
                    }
                    bits_lengths.push(char_count)
                }
            }
            if (obj.flows[fl].nodes[n].hasOwnProperty('router')) {
                if (obj.flows[fl].nodes[n].router.operand == "@input.text") {
                    for (var c = 0; c < obj.flows[fl].nodes[n].router.cases.length; c++) {
                        var curr_case = obj.flows[fl].nodes[n].router.cases[c];
                        if (word_tests.includes(curr_case.type)) {
                            var case_id = curr_case.uuid;
                            var trasl_to_add = {};
                            trasl_to_add.arguments = curr_case.arguments;
                            eng_localization[case_id] = trasl_to_add;

                        }
                    }

                }



            }
        }

        var flow_id = obj.flows[fl].uuid;
        var flow_info = {};
        flow_info.flowid = flow_id;
        flow_info.name = obj.flows[fl].name;
        localization.eng = eng_localization;
        flow_info.localization = localization;
        bits_to_translate[flow_id] = flow_info;
        localization = {};
        eng_localization = {};
    }
    var average = (bits_lengths.reduce((a, b) => a + b, 0))/bits_lengths.length;
    console.log("average length " + average)
    console.log(bits_lengths)
    return bits_to_translate;
}


///////////////// step 2
 function create_file_for_translators(obj) {

    var new_file = [];
    var word_count = 0;
    var char_count = 0;
    var count = 1;

    for (var fl in obj) {
        //if (obj[fl].name.startsWith("PLH - Supportive") || obj[fl].name.startsWith("PLH - Activity") || obj[fl].name.startsWith("PLH - Content")) {
        //if (!obj[fl].name.startsWith("PLH - Supportive")) {
        //if (!obj[fl].name.startsWith("PLH - Content")) {
        //if (!obj[fl].name.startsWith("PLH - Activity")) {
            
           // continue;
            //break

        //}
        //console.log(obj[fl].name)
        var localization = obj[fl].localization.eng;
        for (var key_bit in localization) {
            var bit = localization[key_bit];
            if (bit.hasOwnProperty('text')) {
                var lines = bit.text[0].split("\n");
                var atom_to_translate = {};
                atom_to_translate.has_extraline = 0;
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i] == "") {
                        atom_to_translate.has_extraline++;
                    }
                    else {
                        atom_to_translate.flow_id = fl;
                        atom_to_translate.flow_name = obj[fl].name;
                        atom_to_translate.bit_id = key_bit;
                        atom_to_translate.bit_type = "text";
                        atom_to_translate.type_id = i;
                        if (lines[i].startsWith("•\t")) {
                            atom_to_translate.text = lines[i].replace("•\t", "");
                            atom_to_translate.has_bullet = true;
                        }
                        else {
                            atom_to_translate.text = lines[i];
                        }
                        if (lines[i].indexOf("@") > -1) {
                            atom_to_translate.note = "Strings like @fields.xxx and @results.yyy should not be translated. ";
                            if (lines[i].indexOf("survey") > -1) {
                                atom_to_translate.note = atom_to_translate.note + "@fields.survey_behave_name is the name of the child";
                            }
                            if (lines[i].indexOf("count") > -1) {
                                atom_to_translate.note = atom_to_translate.note + "@results.count is a number (counter for list)";
                            }
                            if (lines[i].indexOf("skills") > -1) {
                                atom_to_translate.note = atom_to_translate.note + "@results.n_skills_week and results.n_skills are numbers";
                            }

                        }
                        atom_to_translate.word_count = word_count;
                        atom_to_translate.source_text = atom_to_translate.text;
                        new_file.push(Object.assign({}, atom_to_translate));
                        word_count = word_count + atom_to_translate.text.split(" ").length;
                        char_count = char_count + atom_to_translate.text.length;
                        atom_to_translate = {};
                        atom_to_translate.has_extraline = 0;
                    }
                }
            }
            if (bit.hasOwnProperty('quick_replies')) {
                for (var qr = 0; qr < bit.quick_replies.length; qr++) {
                    var atom_to_translate = {};
                    atom_to_translate.flow_id = fl;
                    atom_to_translate.flow_name = obj[fl].name;
                    atom_to_translate.bit_id = key_bit;
                    atom_to_translate.bit_type = "quick_replies";
                    atom_to_translate.type_id = qr;
                    atom_to_translate.text = bit.quick_replies[qr];
                    atom_to_translate.source_text = atom_to_translate.text;
                    atom_to_translate.note = "This is a quick reply and its translation should be uniquely identified by the corresponding argument"

                    atom_to_translate.word_count = word_count;
                    new_file.push(Object.assign({}, atom_to_translate));
                    word_count = word_count + atom_to_translate.text.split(" ").length;
                    char_count = char_count + atom_to_translate.text.length;
                }
            }
            if (bit.hasOwnProperty('arguments')) {

                var atom_to_translate = {};
                atom_to_translate.flow_id = fl;
                atom_to_translate.flow_name = obj[fl].name;
                atom_to_translate.bit_id = key_bit;
                atom_to_translate.bit_type = "arguments";
                atom_to_translate.text = bit.arguments[0];
                atom_to_translate.source_text = atom_to_translate.text;
                atom_to_translate.note = "This is an argument and it may be used to identify a corresponding quick reply"

                atom_to_translate.word_count = word_count;
                new_file.push(Object.assign({}, atom_to_translate));
                word_count = word_count + atom_to_translate.text.split(" ").length;
                char_count = char_count + atom_to_translate.text.length;
            }




        }
        /*
            if (word_count > 2000) {
                new_file = JSON.stringify(new_file, null, 2);
                //output_path = path.join(__dirname, "../products/covid-19-parenting/development/non_nested_file_for_translation_plh_master_part_" + count + ".json");
                output_path = path.join(__dirname, "../products/covid-19-parenting/development//translation/eng/file_for_translation_plh_master_activity_" + count + ".json");
                fs.writeFile(output_path, new_file, function (err, result) {
                    if (err) console.log('error', err);
                });
                word_count = 0;
                new_file = [];
                count++;
        
            }
            */

    }
    console.log("word count: "  + word_count)
    console.log("char count: "  + char_count)
    return new_file;
}



///////////////////// step 3
 function remove_repetitions(obj) {
    
    var new_file = [];

    var word_count = 0;
    var char_count = 0;
    var bit_types = ["text", "quick_replies", "arguments"];
    var new_bit = {};

    bit_types.forEach((type) => {
        var obj_filtered = obj.filter(function (atom) { return (atom.bit_type == type) });

        var distinct_text = [... new Set(obj_filtered.map(x => { if (type == "arguments") { return x.text.toLowerCase() } else { return x.text } }))];

        distinct_text.forEach((unique_string) => {
            var obj_same_text = obj_filtered.filter(function (atom) {if (type == "arguments") {return (atom.text.toLowerCase() == unique_string.toLowerCase())}else{return(atom.text == unique_string)} });
           
            new_bit.SourceText = unique_string;
            new_bit.text = unique_string;
            new_bit.type = type;
            if (obj_same_text[0].hasOwnProperty('note')) { new_bit.note = obj_same_text[0].note };
            new_file.push(Object.assign({}, new_bit));
            word_count = word_count + unique_string.split(" ").length;
            char_count = char_count + unique_string.length;
            new_bit = {};
        })

    });

    console.log ("without rep " + word_count)
    console.log ("without rep " + char_count)
return new_file;
}
