% 269181H
% Rashen W.G.M
:- dynamic stock/2.
:- op(600, xfx, requires).

part(engine_oil, 'Engine oil', litres).
part(oil_filter, 'Oil filter', units).
part(brake_pads, 'Brake pad set', sets).
part(brake_fluid, 'Brake fluid', bottles).
part(air_filter, 'Air filter', units).
part(spark_plug, 'Spark plug', units).

service(oil_service, 'Oil service').
service(brake_service, 'Brake service').
service(air_filter_service, 'Air filter replacement').
service(engine_tune_up, 'Engine tune-up').

oil_service requires [need(engine_oil, 4), need(oil_filter, 1)].
brake_service requires [need(brake_pads, 1), need(brake_fluid, 1)].
air_filter_service requires [need(air_filter, 1)].
engine_tune_up requires [need(spark_plug, 4), need(air_filter, 1)].

initial_stock(engine_oil, 12).
initial_stock(oil_filter, 0).
initial_stock(brake_pads, 2).
initial_stock(brake_fluid, 0).
initial_stock(air_filter, 1).
initial_stock(spark_plug, 6).

minimum_stock(engine_oil, 4).
minimum_stock(oil_filter, 2).
minimum_stock(brake_pads, 1).
minimum_stock(brake_fluid, 1).
minimum_stock(air_filter, 2).
minimum_stock(spark_plug, 4).

list_member(X, [X|_]).

list_member(X, [_|Tail]) :-
    list_member(X, Tail).

conc([], List, List).

conc([Head|Tail], List2, [Head|CombinedTail]) :-
    conc(Tail, List2, CombinedTail).

list_count([], 0).

list_count([_|Tail], Count) :-
    list_count(Tail, TailCount),
    Count is TailCount + 1.

valid_jobs(Jobs) :-
    is_list(Jobs), Jobs = [_|_], list_count(Jobs, N), N =< 12,
    findall(ID, service(ID, _), Allowed),
    known_jobs(Jobs, Allowed).
known_jobs([], _).
known_jobs([Job|Tail], Allowed) :-
    atom(Job), once(list_member(Job, Allowed)), known_jobs(Tail, Allowed).

required_parts([], []).

required_parts([Job|Jobs], Combined) :-
    Job requires ThisJob,
    required_parts(Jobs, OtherJobs),
    conc(ThisJob, OtherJobs, Combined).

required_part(Item, Jobs) :-
    valid_jobs(Jobs), required_parts(Jobs, Raw),
    list_member(need(Item, _), Raw).

aggregate_parts([], []).
aggregate_parts([need(Item, Qty)|Tail], [need(Item, Total)|Rest]) :-
    collect_same(Item, Tail, SameQty, Remaining),
    Total is Qty + SameQty,
    aggregate_parts(Remaining, Rest).

collect_same(_, [], 0, []).
collect_same(Item, [need(Item, Qty)|Tail], Total, Remaining) :-

    !,
    collect_same(Item, Tail, TailQty, Remaining),
    Total is Qty + TailQty.
collect_same(Item, [need(Other, Qty)|Tail], Total, [need(Other, Qty)|Rest]) :-
    collect_same(Item, Tail, Total, Rest).

stock_shortage(Item, Needed, Available, Missing) :-
    stock(Item, Available),
    Missing is max(0, Needed - Available).

needs_reorder(Item, Amount) :-
    stock(Item, Available), minimum_stock(Item, Minimum),
    Available < Minimum,
    Amount is Minimum - Available.

requirement_rows([], []).
requirement_rows([need(Item, Needed)|Tail], [Row|Rows]) :-
    part(Item, Name, Unit), stock_shortage(Item, Needed, Available, Missing),
    ( Missing =:= 0 -> Status = ready ; Status = missing ),
    Row = row{id:Item, name:Name, unit:Unit, required:Needed,
              available:Available, missing:Missing, status:Status},
    requirement_rows(Tail, Rows).

missing_items([], []).
missing_items([Row|Tail], Items) :-
    missing_items(Tail, Rest),
    ( Row.missing > 0 -> Items = [Row.id|Rest] ; Items = Rest ).

job_report(Jobs, Report) :-
    valid_jobs(Jobs),
    required_parts(Jobs, Raw), aggregate_parts(Raw, Totals),
    requirement_rows(Totals, Rows), missing_items(Rows, Missing),
    list_count(Jobs, JobCount), list_count(Raw, RawCount),
    list_count(Totals, PartCount), list_count(Missing, MissingCount),
    ( MissingCount =:= 0 -> Status = ready ; Status = missing ),
    term_text(Raw, RawText), term_text(Totals, TotalText),
    Report = report{jobs:JobCount, raw_count:RawCount, part_types:PartCount,
                    missing_types:MissingCount, status:Status, rows:Rows,
                    raw:RawText, totals:TotalText}.

service_catalog(Rows) :-
    findall(service{id:ID,name:Name}, service(ID, Name), Rows).
inventory(Rows) :-
    findall(part{id:ID,name:Name,unit:Unit,quantity:Qty,minimum:Min},
            (part(ID, Name, Unit), stock(ID, Qty), minimum_stock(ID, Min)), Rows).

add_stock(Item, Added, New) :-
    atom(Item), part(Item, _, _), integer(Added), Added > 0,
    stock(Item, Old), New is Old + Added, New =< 1000000,
    retract(stock(Item, Old)),
    assertz(stock(Item, New)).

restore_stock(Pairs) :-
    is_list(Pairs), valid_pairs(Pairs),
    findall(ID, list_member(stock(ID, _), Pairs), IDs),
    findall(ID, part(ID, _, _), Expected),
    msort(IDs, Sorted), msort(Expected, Sorted),
    retractall(stock(_, _)), assert_pairs(Pairs).
valid_pairs([]).
valid_pairs([stock(Item, Qty)|Tail]) :-
    atom(Item), part(Item, _, _), integer(Qty), Qty >= 0, Qty =< 1000000,
    valid_pairs(Tail).
assert_pairs([]).
assert_pairs([Fact|Tail]) :- assertz(Fact), assert_pairs(Tail).

reset_stock :-
    findall(stock(ID, Qty), initial_stock(ID, Qty), Pairs), restore_stock(Pairs).

print_shortages(Jobs) :-
    job_report(Jobs, Report),
    list_member(Row, Report.rows), Row.missing > 0,
    write(Row.id), write(': add '), write(Row.missing), write(' '),
    write(Row.unit), nl,
    fail.

print_shortages(_) :- write('End of shortage list.'), nl.

start :-
    write('Enter service IDs as a list, followed by a full stop.'), nl,
    read(Jobs),
    ( valid_jobs(Jobs)
    -> print_shortages(Jobs)
    ; write('Invalid input: enter a non-empty list of known service IDs.'), nl
    ).

term_text(Term, Text) :-
    copy_term(Term, Copy), numbervars(Copy, 0, _),
    with_output_to(atom(Text), write_term(Copy, [quoted(true), numbervars(true)])).

:- initialization(reset_stock).
