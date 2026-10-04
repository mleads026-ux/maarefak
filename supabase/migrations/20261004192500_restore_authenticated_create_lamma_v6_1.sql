revoke all on function public.create_lamma(text,text,text,text,boolean,text) from public;
revoke execute on function public.create_lamma(text,text,text,text,boolean,text) from anon;
grant execute on function public.create_lamma(text,text,text,text,boolean,text) to authenticated;
