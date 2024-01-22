exports.getDate = ()=>{
    //From StackOverflow, starting from here -
    let todays_date = new Date();
    let options={
        weekday: "long",
        day: "numeric",
        month: "long"
        // year: "numeric"
    }
    let day=todays_date.toLocaleDateString("en-US",options)
    //- to this end.
    return day
}

//To export another one just do like above